import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { ChatCrypto } from "@/lib/crypto";
import { Loader2 } from "lucide-react";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@/lib/convex-helpers";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { CallManager, useCall } from "@/call";
import { typedApi } from "@/lib/api-types";
import { mergeCachedMessages, resolveRemoteCallName, shouldResetCallOverlay } from "@/lib/call-chat-utils";
import { captureCallReturnPath } from "@/lib/call-navigation";

// CometChat Components
import { CometChatLayout } from "./CometChatLayout";
import { CometChatSidebar } from "./CometChatSidebar";
import { CometChatHeader } from "./CometChatHeader";
import { CometChatMessageList, Message as CometMessageBase } from "./CometChatMessageList";
import { CometChatMessageComposer } from "./CometChatMessageComposer";

interface CometMessage extends CometMessageBase {
  replyToMessage?: {
    senderName: string;
    content: string;
    type: 'text' | 'image' | 'file' | 'audio' | 'system';
  };
}

interface Message {
  _id: Id<"messages">;
  senderName: string;
  senderAvatar: string;
  content: string;
  messageType: "text" | "image" | "file" | "audio" | "system" | "join" | "leave";
  isRead: boolean;
  readAt?: number;
  selfDestructAt?: number;
  _creationTime: number;
  encryptionKeyId: string;
  senderId?: Id<"users">;
  reactions?: MessageReaction[];
}

interface MessageReaction {
  emoji: string;
  participantId: Id<"participants">;
  displayName: string;
  createdAt: number;
}

interface ChatRoomProps {
  roomId: string;
  displayName: string;
  encryptionKey: CryptoKey;
  participantId: string;
}

const MESSAGE_CACHE_TTL_MS = 5 * 60 * 1000;

function readMessageCacheFromStorage(roomId: string): Message[] {
  const cacheKey = `room_message_cache_${roomId}`;
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.cachedAt === "number" &&
      Array.isArray(parsed.messages)
    ) {
      if (Date.now() - parsed.cachedAt <= MESSAGE_CACHE_TTL_MS) {
        return parsed.messages as Message[];
      }
      sessionStorage.removeItem(cacheKey);
      return [];
    }
    if (Array.isArray(parsed)) return parsed as Message[];
  } catch {
    // ignore
  }
  return [];
}

export default function CometChatRoom({ roomId, displayName, encryptionKey, participantId }: ChatRoomProps) {
  const { user } = useAuth();
  const { state: callUiState, receiveIncomingCall, endCall } = useCall();
  const navigate = useNavigate();
  
  // State
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);

  // Queries
  const room = useQuery((api as any).rooms.getRoomByRoomId, { roomId });
  const participants = useQuery((api as any).rooms.getRoomParticipants, { roomId });
  const messages = useQuery((api as any).messages.getRoomMessages, { roomId, limit: 500 });
  const activeCall = useQuery(typedApi.calls.listByRoom, { roomId });

  // Mutations
  const sendMessageMutation = useMutation((api as any).messages.sendMessage);
  const editMessageMutation = useMutation((api as any).messages.editMessage);
  const markReadMutation = useMutation((api as any).messages.markMessageRead);
  const leaveRoomMutation = useMutation((api as any).rooms.leaveRoom);
  const updateActivityMutation = useMutation((api as any).rooms.updateActivity);
  const kickParticipantMutation = useMutation((api as any).rooms.kickParticipant);
  const clearParticipantsMutation = useMutation((api as any).rooms.clearParticipants);
  const cleanupExpiredMutation = useMutation((api as any).rooms.cleanupExpired);
  const setTypingMutation = useMutation((api as any).rooms.setTyping);
  const rejectInviteMutation = useMutation(typedApi.calls.rejectInvite);
  const toggleReactionMutation = useMutation(typedApi.messages.toggleReaction);
  const deleteMessageMutation = useMutation((api as any).messages.deleteMessage);

  // Local State
  const [, setKeyRotationCount] = useState(0);
  const [dismissedCallIds, setDismissedCallIds] = useState<Set<string>>(new Set());
  const [messageCache, setMessageCache] = useState<Message[]>(() => readMessageCacheFromStorage(roomId));
  const [decryptedMessages, setDecryptedMessages] = useState<CometMessage[]>([]);
  const [pendingMessages, setPendingMessages] = useState<CometMessage[]>([]);
  
  const incomingHandledRef = useRef<Set<string>>(new Set());
  const lastTypingSentRef = useRef<number>(0);
  const roomMissingSinceRef = useRef<number | null>(null);
  const participantMissingSinceRef = useRef<number | null>(null);
  const pendingMessagesRef = useRef<CometMessage[]>([]);

  const removePendingMessage = useCallback((pendingId: string) => {
    setPendingMessages((prev) => {
      const pending = prev.find((m) => m._id === pendingId);
      if (pending?.storageId?.startsWith("blob:")) {
        URL.revokeObjectURL(pending.storageId);
      }
      return prev.filter((m) => m._id !== pendingId);
    });
  }, []);

  useEffect(() => {
    pendingMessagesRef.current = pendingMessages;
  }, [pendingMessages]);

  useEffect(() => {
    return () => {
      pendingMessagesRef.current.forEach((message) => {
        if (message.storageId?.startsWith("blob:")) {
          URL.revokeObjectURL(message.storageId);
        }
      });
    };
  }, []);

  // --- Effects & Logic ---

  // Validate Props
  useEffect(() => {
    if (!roomId || !displayName || !encryptionKey || !participantId) {
      toast.error("Invalid room session. Please rejoin.");
      navigate("/");
    }
  }, [roomId, displayName, encryptionKey, participantId, navigate]);

  // Message Cache Sync
  useEffect(() => {
    setMessageCache(readMessageCacheFromStorage(roomId));
  }, [roomId]);

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    setMessageCache((prev) => {
      const merged = mergeCachedMessages(prev, messages as Message[]);
      try {
        sessionStorage.setItem(
          `room_message_cache_${roomId}`,
          JSON.stringify({ cachedAt: Date.now(), messages: merged })
        );
      } catch (error) {
        console.warn("Failed to update cache:", error);
      }
      return merged;
    });
  }, [messages, roomId]);

  const visibleMessages = useMemo(
    () => mergeCachedMessages(messageCache, (messages ?? undefined) as Message[] | undefined),
    [messageCache, messages]
  );

  const displayedMessages = useMemo(
    () =>
      [...decryptedMessages, ...pendingMessages].sort(
        (a, b) => a.createdAt - b.createdAt
      ),
    [decryptedMessages, pendingMessages]
  );

  // Decrypt Messages
  useEffect(() => {
    const decryptAll = async () => {
      const promises = visibleMessages.map(async (msg) => {
        let content = msg.content;
        const normalizedType =
          msg.messageType === "join" || msg.messageType === "leave"
            ? "system"
            : msg.messageType;

        if (["text", "image", "file", "audio"].includes(normalizedType)) {
          try {
            content = await ChatCrypto.decrypt(msg.content, encryptionKey);
          } catch {
            content = '[Encrypted Message]';
          }
        }
        
        // Map reactions
        const reactionsMap = new Map<string, { count: number; reactedByMe: boolean }>();
        msg.reactions?.forEach(r => {
          const existing = reactionsMap.get(r.emoji);
          if (existing) {
            existing.count++;
            if (r.participantId === participantId) existing.reactedByMe = true;
          } else {
            reactionsMap.set(r.emoji, { 
              count: 1, 
              reactedByMe: r.participantId === participantId 
            });
          }
        });

        const reactions = Array.from(reactionsMap.entries()).map(([emoji, data]) => ({
          emoji,
          count: data.count,
          reactedByMe: data.reactedByMe
        }));

        return {
          _id: msg._id as string,
          content,
          senderId: msg.senderId as string | undefined,
          senderName: msg.senderName,
          senderAvatar: msg.senderAvatar,
          createdAt: msg._creationTime,
          isMe: msg.senderName === displayName,
          isRead: msg.isRead,
          type: normalizedType as 'text' | 'system' | 'image' | 'file' | 'audio',
          reactions,
          storageId: (msg as any).fileUrl || (msg as any).storageId,
          fileName: (msg as any).fileName || (normalizedType !== "text" && normalizedType !== "system" ? content : undefined),
          fileSize: undefined,
          mimeType: undefined,
          isEncryptedFile: true,
          replyTo: (msg as any).replyTo,
          replyToMessage: undefined
        };
      });
      
      const results = await Promise.all(promises);
      
      // Second pass to resolve reply content
      const finalResults = results.map(msg => {
        if (msg.replyTo) {
          const parent = results.find(p => p._id === msg.replyTo);
          if (parent) {
             (msg as CometMessage).replyToMessage = {
               senderName: parent.senderName,
               content: parent.content,
               type: parent.type
             };
          }
        }
        return msg as CometMessage;
      });

      setDecryptedMessages(finalResults);
    };
    decryptAll();
  }, [visibleMessages, encryptionKey, displayName, participantId]);

  // Mark Read
  const safeMarkRead = useCallback(async (messageId: Id<"messages">) => {
    try {
      await markReadMutation({ messageId, participantId: participantId as any });
    } catch (error) {
      console.debug("Mark read skipped:", error);
    }
  }, [markReadMutation, participantId]);

  useEffect(() => {
    visibleMessages.forEach(msg => {
      if (!msg.isRead && msg.senderName !== displayName) {
        safeMarkRead(msg._id);
      }
    });
  }, [visibleMessages, displayName, safeMarkRead]);

  // Participant Presence Check
  useEffect(() => {
    if (!participants || !participantId) return;
    const meStillPresent = (participants as any[]).some((p: any) => p._id === (participantId as any));
    if (meStillPresent) {
      participantMissingSinceRef.current = null;
      return;
    }
    participantMissingSinceRef.current = Date.now();
    const timeoutId = window.setTimeout(() => {
      if (participantMissingSinceRef.current === null) return;
      toast.error("You have been removed by the admin.");
      localStorage.removeItem(`room_session_${roomId}`);
      navigate("/");
    }, 4000);
    return () => window.clearTimeout(timeoutId);
  }, [participants, participantId, navigate, roomId]);

  // Room Existence Check
  useEffect(() => {
    if (room !== null) {
      roomMissingSinceRef.current = null;
      return;
    }
    roomMissingSinceRef.current = Date.now();
    const timeoutId = window.setTimeout(() => {
      if (roomMissingSinceRef.current === null) return;
      toast.error("Room has been destroyed.");
      localStorage.removeItem(`room_session_${roomId}`);
      navigate("/");
    }, 3000);
    return () => window.clearTimeout(timeoutId);
  }, [room, navigate, roomId]);

  // Activity & Cleanup
  useEffect(() => {
    const interval = setInterval(() => {
      updateActivityMutation({ roomId }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [roomId, updateActivityMutation]);

  useEffect(() => {
    const interval = setInterval(() => {
      cleanupExpiredMutation({}).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [cleanupExpiredMutation]);

  const generateUploadUrlMutation = useMutation((api as any).messages.generateUploadUrl);

  // Handlers
  const [replyTo, setReplyTo] = useState<CometMessage | null>(null);

  const handleSendMessage = async (content: string, type: 'text' | 'image' | 'file' | 'audio', file?: File) => {
    if (!encryptionKey) return;
    const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const pendingBlobUrl =
      file && (type === "image" || type === "file")
        ? URL.createObjectURL(file)
        : undefined;

    setPendingMessages((prev) => [
      ...prev,
      {
        _id: pendingId,
        content,
        senderId: user?._id as string | undefined,
        senderName: displayName,
        senderAvatar: "",
        createdAt: Date.now(),
        isMe: true,
        isRead: false,
        status: "sending",
        type,
        storageId: pendingBlobUrl,
        fileName: file?.name,
        fileSize: file?.size,
        mimeType: file?.type,
        isEncryptedFile: false,
      },
    ]);

    try {
      let storageId: string | undefined;
      let encryptedContent = content;

      if (type !== 'text' && file) {
        // ... (existing upload logic)
        // 1. Encrypt File Content
        const fileBuffer = await file.arrayBuffer();
        const encryptedFileBuffer = await ChatCrypto.encryptFile(fileBuffer, encryptionKey);
        const encryptedBlob = new Blob([encryptedFileBuffer], { type: "application/octet-stream" });

        // 2. Get upload URL
        const postUrl = await generateUploadUrlMutation();
        
        // 3. Upload Encrypted Blob
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: encryptedBlob,
        });
        
        if (!result.ok) throw new Error("Upload failed");
        const { storageId: uploadedId } = await result.json();
        storageId = uploadedId;
        
        // Encrypt file metadata/name
        encryptedContent = await ChatCrypto.encrypt(content || file.name, encryptionKey);
      } else {
        encryptedContent = await ChatCrypto.encrypt(content, encryptionKey);
      }

      await sendMessageMutation({
        roomId,
        content: encryptedContent,
        encryptionKeyId: "current",
        selfDestruct: room?.settings?.selfDestruct || false,
        participantId: participantId as any,
        messageType: type,
        storageId,
        replyTo: replyTo?._id,
      });
      removePendingMessage(pendingId);
      setReplyTo(null); // Clear reply state
      setKeyRotationCount((prev) => {
        const next = prev + 1;
        if (next >= 50) {
          toast.info("Key rotated");
          return 0;
        }
        return next;
      });
      emitTyping(false);
    } catch (error) {
      removePendingMessage(pendingId);
      console.error(error);
      toast.error("Failed to send");
    }
  };

  const handleEditMessage = async (messageId: string, content: string) => {
    try {
      const encryptedContent = await ChatCrypto.encrypt(content, encryptionKey);
      await editMessageMutation({
        messageId: messageId as any,
        content: encryptedContent,
        participantId: participantId as any,
      });
      toast.success("Edited");
    } catch {
      toast.error("Failed to edit");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      await deleteMessageMutation({ messageId: messageId as any });
      toast.success("Message deleted");
    } catch {
      toast.error("Failed to delete message");
    }
  };

  const emitTyping = useCallback((typing: boolean) => {
    const now = Date.now();
    if (typing && now - lastTypingSentRef.current < 800) return;
    lastTypingSentRef.current = now;
    setTypingMutation({ roomId, isTyping: typing }).catch(() => {});
  }, [roomId, setTypingMutation]);

  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      await toggleReactionMutation({
        messageId: messageId as any,
        participantId: participantId as any,
        emoji,
      });
    } catch {
      toast.error("Failed to react");
    }
  }, [participantId, toggleReactionMutation]);

  const handleLeaveRoom = async () => {
    try {
      await leaveRoomMutation({ roomId, participantId: participantId as any });
      localStorage.removeItem(`room_session_${roomId}`);
      navigate("/");
    } catch {
      toast.error("Failed to leave");
    }
  };

  const handleCopyInvite = async () => {
    try {
      const exportedKey = await ChatCrypto.exportKey(encryptionKey);
      const linkWithKey = `${window.location.origin}/join/${roomId}#k=${encodeURIComponent(exportedKey)}`;
      await navigator.clipboard.writeText(linkWithKey);
      toast.success("Invite link copied!");
    } catch {
      toast.error("Unable to export key for invite.");
    }
  };

  const handleKick = async (participantIdToKick: string) => {
    try {
      await kickParticipantMutation({ roomId, participantId: participantIdToKick as any, callerParticipantId: participantId as any });
      toast.success("Member removed");
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove member");
    }
  };

  const handlePanicMode = async () => {
    if (!window.confirm("Destroy room permanently?")) return;
    try {
      await clearParticipantsMutation({ roomId, callerParticipantId: participantId as any, panic: true });
      localStorage.removeItem(`room_session_${roomId}`);
      navigate("/");
    } catch {
      toast.error("Failed to panic");
    }
  };

  // Call Logic
  const activeCallList = activeCall as Doc<"calls">[] | undefined;
  const currentActiveCall = activeCallList?.find(c => c.status === "active" || c.status === "ringing");
  const callerName = participants?.find((p: any) => p.userId === currentActiveCall?.createdBy)?.displayName || "Someone";
  const remoteCallName = resolveRemoteCallName(
    (participants || []).map((p: any) => ({ _id: p._id, displayName: p.displayName })),
    displayName,
    callerName,
    !!currentActiveCall
  );
  const isOwnOutgoingCall = currentActiveCall ? sessionStorage.getItem("outgoing_call_id") === currentActiveCall._id : false;

  useEffect(() => {
    if (!currentActiveCall || currentActiveCall.status !== "ringing") return;
    if (dismissedCallIds.has(currentActiveCall._id)) return;
    if (isOwnOutgoingCall) return;
    if (incomingHandledRef.current.has(currentActiveCall._id)) return;
    
    incomingHandledRef.current.add(currentActiveCall._id);
    receiveIncomingCall(currentActiveCall._id, callerName).catch(console.error);
    
    return () => { incomingHandledRef.current.delete(currentActiveCall._id); };
  }, [currentActiveCall, dismissedCallIds, isOwnOutgoingCall, receiveIncomingCall, callerName]);

  useEffect(() => {
    if (shouldResetCallOverlay(callUiState.status, !!currentActiveCall)) {
      void endCall();
    }
  }, [currentActiveCall, callUiState.status, endCall]);

  // Derived Data
  const onlineCount = (participants || []).filter((p: any) => p.isActive).length;
  const isAdmin = useMemo(() => {
    const me = (participants || []).find((p: any) => p._id === participantId);
    return me?.role === "admin" || (user && room?.creatorId && user._id === room.creatorId);
  }, [participants, participantId, user, room]);

  const mappedParticipants = (participants || []).map((p: any) => ({
    id: p._id,
    name: p.displayName,
    avatar: p.avatar,
    isOnline: p.isActive,
    isTyping: p.isTyping && (p.typingUpdatedAt ?? 0) > Date.now() - 4000
  }));

  if (room === undefined) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (room === null) return <div className="flex h-screen items-center justify-center">Room Not Found</div>;

  return (
    <>
      <CometChatLayout
        showSidebarMobile={isSidebarMobileOpen}
        onToggleSidebar={() => setIsSidebarMobileOpen(!isSidebarMobileOpen)}
        sidebar={
          <CometChatSidebar
            currentUser={{ id: participantId, name: displayName, status: 'online' }}
            roomName={room.name || "Chat Room"}
            participants={mappedParticipants}
            onLogout={handleLeaveRoom}
            isAdmin={isAdmin}
            onKick={handleKick}
          />
        }
      >
        <CometChatHeader
          roomName={room.name || "Chat Room"}
          subtitle={`${onlineCount} members active`}
          onlineCount={onlineCount}
          onToggleSidebar={() => setIsSidebarMobileOpen(true)}
          onCall={(video) => {
            sessionStorage.setItem("call_display_name", displayName);
            sessionStorage.setItem("call_room_id", roomId);
            captureCallReturnPath(roomId);
            navigate(`/call/new?video=${video}`);
          }}
          isAdmin={isAdmin}
          onLeaveRoom={handleLeaveRoom}
          onDeleteRoom={handlePanicMode}
          onCopyInvite={handleCopyInvite}
          onClearChat={() => {
            clearParticipantsMutation({ roomId, callerParticipantId: participantId as any, panic: false });
          }}
        />

        <CometChatMessageList
          messages={displayedMessages}
          onReact={handleReaction}
          onEdit={handleEditMessage}
          onDelete={handleDeleteMessage}
          onReply={(msgId) => {
            const msg = decryptedMessages.find(m => m._id === msgId);
            if (msg) setReplyTo(msg);
          }}
          encryptionKey={encryptionKey}
        />

        <CometChatMessageComposer
          onSend={handleSendMessage}
          onTyping={emitTyping}
          replyTo={replyTo ? {
            senderName: replyTo.senderName,
            content: replyTo.content,
            type: replyTo.type
          } : null}
          onCancelReply={() => setReplyTo(null)}
        />
      </CometChatLayout>

      <CallManager
        remoteName={remoteCallName}
        onAcceptIncoming={async () => {
          if (!currentActiveCall) return;
          sessionStorage.setItem("call_display_name", displayName);
          sessionStorage.setItem("call_room_id", roomId);
          captureCallReturnPath(roomId);
          setDismissedCallIds(prev => new Set(prev).add(currentActiveCall._id));
          navigate(`/call/${currentActiveCall._id}`);
        }}
        onRejectIncoming={async () => {
          if (!currentActiveCall) return;
          rejectInviteMutation({ callId: currentActiveCall._id, displayName }).catch(console.error);
          setDismissedCallIds(prev => new Set(prev).add(currentActiveCall._id));
        }}
      />
    </>
  );
}
