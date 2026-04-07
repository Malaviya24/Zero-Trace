import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
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
import { shouldSendReadMark } from "@/lib/message-conflict-utils";
import { firstUrlFromText } from "@/lib/url-utils";
import { useAction } from "convex/react";
import { CONFIG } from "@/lib/config";

// CometChat Components
import { CometChatLayout } from "./CometChatLayout";
import { CometChatSidebar } from "./CometChatSidebar";
import { CometChatHeader } from "./CometChatHeader";
import { CometChatMessageList, Message as CometMessageBase } from "./CometChatMessageList";
import { CometChatMessageComposer } from "./CometChatMessageComposer";
import { ScreenShield } from "@/components/security/ScreenShield";

interface CometMessage extends CometMessageBase {
  replyToMessage?: {
    senderName: string;
    content: string;
    type: 'text' | 'image' | 'video' | 'file' | 'audio' | 'system';
  };
  replyToPreview?: {
    senderName: string;
    content: string;
    type: 'text' | 'image' | 'video' | 'file' | 'audio' | 'system';
  };
}

interface Message {
  _id: Id<"messages">;
  senderName: string;
  senderAvatar: string;
  content: string;
  messageType: "text" | "image" | "video" | "file" | "audio" | "system" | "join" | "leave";
  isRead: boolean;
  readAt?: number;
  selfDestructAt?: number;
  expiresAt?: number;
  _creationTime: number;
  encryptionKeyId: string;
  mimeType?: string;
  senderId?: Id<"users">;
  reactions?: MessageReaction[];
  linkPreviewEncrypted?: string;
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
  participantToken: string;
}

const MESSAGE_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;
const PARTICIPANT_MISSING_CONFIRM_MS = 4500;
const MAX_ATTACHMENT_FILE_NAME_LENGTH = 255;

function sanitizeOutgoingAttachmentName(fileName: string | undefined) {
  const normalized = Array.from((fileName || "").split(/[\\/]/).pop() || "").filter((char) => { const code = char.charCodeAt(0); return code >= 32 && code !== 127; }).join("").trim();
  if (!normalized) return null;
  return normalized.slice(0, MAX_ATTACHMENT_FILE_NAME_LENGTH);
}

function validateOutgoingAttachment(type: "image" | "video" | "file" | "audio", file: File) {
  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    return { error: "File is empty or invalid." } as const;
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { error: "File is too large. Maximum upload size is 100 MB." } as const;
  }
  const fileName = sanitizeOutgoingAttachmentName(file.name);
  if (!fileName) {
    return { error: "File name is missing or invalid." } as const;
  }
  const fallbackMimeType = type === "file" ? "application/octet-stream" : "";
  const mimeType = (file.type || fallbackMimeType).trim().toLowerCase();
  if (!mimeType || mimeType.length > 255 || !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mimeType)) {
    return { error: "File type is missing or invalid." } as const;
  }
  if (type === "image" && !mimeType.startsWith("image/")) return { error: "Image uploads must use an image file type." } as const;
  if (type === "video" && !mimeType.startsWith("video/")) return { error: "Video uploads must use a video file type." } as const;
  if (type === "audio" && !mimeType.startsWith("audio/")) return { error: "Audio uploads must use an audio file type." } as const;
  return { fileName, mimeType } as const;
}

const ROOM_MISSING_CONFIRM_MS = 3500;
const isMessageActive = (message: Message, now = Date.now()) =>
  (!message.expiresAt || message.expiresAt > now) &&
  (!message.selfDestructAt || message.selfDestructAt > now);

function readMessageCacheFromStorage(roomId: string): Message[] {
  const cacheKey = `room_message_cache_${roomId}`;
  const now = Date.now();
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
        return (parsed.messages as Message[]).filter((message) => isMessageActive(message, now));
      }
      sessionStorage.removeItem(cacheKey);
      return [];
    }
    if (Array.isArray(parsed)) return (parsed as Message[]).filter((message) => isMessageActive(message, now));
  } catch {
    // ignore
  }
  return [];
}

export default function CometChatRoom({ roomId, displayName, encryptionKey, participantId, participantToken }: ChatRoomProps) {
  const { state: callUiState, receiveIncomingCall, endCall } = useCall();
  const navigate = useNavigate();
  
  // State
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);

  // Queries
  const room = useQuery((api as any).rooms.getRoomByRoomId, { roomId });
  const participants = useQuery((api as any).rooms.getRoomParticipants, {
    roomId,
    participantId: participantId as any,
    participantToken,
  });
  const messages = useQuery((api as any).messages.getRoomMessages, {
    roomId,
    participantId: participantId as any,
    participantToken,
    limit: 500,
  });
  const activeCall = useQuery(typedApi.calls.listByRoom, {
    roomId,
    participantId: participantId as any,
    participantToken,
  });

  // Mutations
  const sendMessageMutation = useMutation((api as any).messages.sendMessage);
  const editMessageMutation = useMutation((api as any).messages.editMessage);
  const markReadMutation = useMutation((api as any).messages.markMessageRead);
  const leaveRoomMutation = useMutation((api as any).rooms.leaveRoom);
  const updateActivityMutation = useMutation((api as any).rooms.updateActivity);
  const kickParticipantMutation = useMutation((api as any).rooms.kickParticipant);
  const clearParticipantsMutation = useMutation((api as any).rooms.clearParticipants);
  const setTypingMutation = useMutation((api as any).rooms.setTyping);
  const rejectInviteMutation = useMutation(typedApi.calls.rejectInvite);
  const toggleReactionMutation = useMutation(typedApi.messages.toggleReaction);
  const deleteMessageMutation = useMutation((api as any).messages.deleteMessage);
  const unfurlUrlAction = useAction((api as any).messages.unfurlUrl);

  // Local State
  const [, setKeyRotationCount] = useState(0);
  const [dismissedCallIds, setDismissedCallIds] = useState<Set<string>>(new Set());
  const [messageCache, setMessageCache] = useState<Message[]>(() => readMessageCacheFromStorage(roomId));
  const [decryptedMessages, setDecryptedMessages] = useState<CometMessage[]>([]);
  const [pendingMessages, setPendingMessages] = useState<CometMessage[]>([]);
  const [replyTo, setReplyTo] = useState<CometMessage | null>(null);
  
  const incomingHandledRef = useRef<Set<string>>(new Set());
  const lastTypingSentRef = useRef<number>(0);
  const roomMissingSinceRef = useRef<number | null>(null);
  const participantMissingSinceRef = useRef<number | null>(null);
  const pendingMessagesRef = useRef<CometMessage[]>([]);
  const sentReadIdsRef = useRef<Set<string>>(new Set());
  const sessionInvalidatedRef = useRef(false);

  const isSessionInvalidError = useCallback((error: unknown) => {
    const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
    return (
      message.includes("unauthorized") ||
      message.includes("room not found") ||
      message.includes("expired")
    );
  }, []);

  const invalidateRoomSession = useCallback((reason?: string) => {
    if (sessionInvalidatedRef.current) return;
    sessionInvalidatedRef.current = true;
    localStorage.removeItem(`room_session_${roomId}`);
    if (reason) toast.error(reason);
    navigate(`/join/${roomId}`);
  }, [navigate, roomId]);

  const confirmSessionStillValid = useCallback(async () => {
    try {
      await updateActivityMutation({
        roomId,
        participantId: participantId as any,
        participantToken,
      });
      return true;
    } catch (error) {
      if (isSessionInvalidError(error)) {
        return false;
      }
      // Treat transient network/backend errors as recoverable.
      return true;
    }
  }, [isSessionInvalidError, participantId, participantToken, roomId, updateActivityMutation]);

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
      invalidateRoomSession("Invalid room session. Please rejoin.");
    }
  }, [roomId, displayName, encryptionKey, participantId, invalidateRoomSession]);

  // Message Cache Sync
  useEffect(() => {
    sentReadIdsRef.current.clear();
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
        const normalizedMimeType = (msg.mimeType || "").toLowerCase();
        const normalizedTypeBase =
          msg.messageType === "join" || msg.messageType === "leave"
            ? "system"
            : msg.messageType;
        const normalizedType =
          normalizedTypeBase === "file" && normalizedMimeType.startsWith("audio/")
            ? "audio"
            : normalizedTypeBase;
        const rawReplyToPreview = (msg as any).replyToPreview as
          | { senderName: string; content: string; type: 'text' | 'image' | 'video' | 'file' | 'audio' | 'system' }
          | undefined;

        if (["text", "image", "video", "file", "audio"].includes(normalizedType)) {
          try {
            content = await ChatCrypto.decrypt(msg.content, encryptionKey);
          } catch {
            content = '[Encrypted Message]';
          }
        }

        let replyToPreview: CometMessage["replyToPreview"] | undefined;
        if (rawReplyToPreview) {
          let previewContent = rawReplyToPreview.content;
          if (["text", "image", "video", "file", "audio"].includes(rawReplyToPreview.type)) {
            try {
              previewContent = await ChatCrypto.decrypt(rawReplyToPreview.content, encryptionKey);
            } catch {
              previewContent = "[Encrypted Message]";
            }
          }
          replyToPreview = {
            senderName: rawReplyToPreview.senderName,
            content: previewContent,
            type: rawReplyToPreview.type,
          };
        }

        let linkPreview: CometMessage["linkPreview"] | undefined;
        const rawLinkPreviewEncrypted = (msg as any).linkPreviewEncrypted as string | undefined;
        if (normalizedType === "text" && rawLinkPreviewEncrypted) {
          try {
            const decrypted = await ChatCrypto.decrypt(rawLinkPreviewEncrypted, encryptionKey);
            const parsed = JSON.parse(decrypted);
            if (parsed && typeof parsed === "object" && typeof parsed.canonicalUrl === "string") {
              linkPreview = {
                canonicalUrl: parsed.canonicalUrl,
                title: typeof parsed.title === "string" ? parsed.title : undefined,
                description: typeof parsed.description === "string" ? parsed.description : undefined,
                image: typeof parsed.image === "string" ? parsed.image : undefined,
                siteName: typeof parsed.siteName === "string" ? parsed.siteName : undefined,
              };
            }
          } catch {
            // Ignore malformed or undecryptable preview payload.
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
          type: normalizedType as 'text' | 'system' | 'image' | 'video' | 'file' | 'audio',
          reactions,
          storageId: (msg as any).fileUrl || (msg as any).storageId,
          fileName: (msg as any).fileName || (normalizedType !== "text" && normalizedType !== "system" ? content : undefined),
          fileSize: (msg as any).fileSize,
          mimeType: (msg as any).mimeType,
          isEncryptedFile: true,
          replyTo: (msg as any).replyTo ? String((msg as any).replyTo) : undefined,
          replyToMessage: undefined,
          replyToPreview,
          linkPreview,
        };
      });
      
      const results = await Promise.all(promises);
      
      // Second pass to resolve reply content
      const finalResults = results.map(msg => {
        if (msg.replyTo) {
          const parent = results.find(p => String(p._id) === String(msg.replyTo));
          if (parent) {
             (msg as CometMessage).replyToMessage = {
               senderName: parent.senderName,
               content: parent.content,
               type: parent.type
             };
          } else if ((msg as CometMessage).replyToPreview) {
             (msg as CometMessage).replyToMessage = (msg as CometMessage).replyToPreview;
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
    const messageKey = String(messageId);
    if (sentReadIdsRef.current.has(messageKey)) return;
    sentReadIdsRef.current.add(messageKey);
    try {
      await markReadMutation({
        messageId,
        participantId: participantId as any,
        participantToken,
      });
    } catch (error) {
      sentReadIdsRef.current.delete(messageKey);
      if (isSessionInvalidError(error)) {
        invalidateRoomSession("Room session expired. Please rejoin.");
        return;
      }
      console.debug("Mark read skipped:", error);
    }
  }, [markReadMutation, participantId, participantToken, isSessionInvalidError, invalidateRoomSession]);

  useEffect(() => {
    visibleMessages.forEach(msg => {
      if (
        shouldSendReadMark(
          String(msg._id),
          msg.isRead,
          msg.senderName,
          displayName,
          sentReadIdsRef.current
        )
      ) {
        void safeMarkRead(msg._id);
      }
    });
  }, [visibleMessages, displayName, safeMarkRead]);

  // Participant Presence Check
  useEffect(() => {
    if (participants === undefined || !participantId) return;
    const meStillPresent = (participants as any[]).some((p: any) => p._id === (participantId as any));
    if (meStillPresent) {
      participantMissingSinceRef.current = null;
      return;
    }
    if (participantMissingSinceRef.current === null) {
      participantMissingSinceRef.current = Date.now();
    }

    const missingSince = participantMissingSinceRef.current;
    const elapsed = Date.now() - missingSince;
    const remainingMs = Math.max(0, PARTICIPANT_MISSING_CONFIRM_MS - elapsed);

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        if (participantMissingSinceRef.current !== missingSince || sessionInvalidatedRef.current) return;
        const stillValid = await confirmSessionStillValid();
        if (!stillValid) {
          invalidateRoomSession("You have been removed by the admin.");
          return;
        }
        participantMissingSinceRef.current = null;
      })();
    }, remainingMs);

    return () => window.clearTimeout(timeoutId);
  }, [participants, participantId, confirmSessionStillValid, invalidateRoomSession]);

  // Room Existence Check
  useEffect(() => {
    if (room === undefined) return;
    if (room !== null) {
      roomMissingSinceRef.current = null;
      return;
    }
    if (roomMissingSinceRef.current === null) {
      roomMissingSinceRef.current = Date.now();
    }

    const missingSince = roomMissingSinceRef.current;
    const elapsed = Date.now() - missingSince;
    const remainingMs = Math.max(0, ROOM_MISSING_CONFIRM_MS - elapsed);

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        if (roomMissingSinceRef.current !== missingSince || sessionInvalidatedRef.current) return;
        const stillValid = await confirmSessionStillValid();
        if (!stillValid) {
          invalidateRoomSession("Room expired or was destroyed.");
          return;
        }
        roomMissingSinceRef.current = null;
      })();
    }, remainingMs);

    return () => window.clearTimeout(timeoutId);
  }, [room, confirmSessionStillValid, invalidateRoomSession]);

  // Activity heartbeat
  useEffect(() => {
    const interval = setInterval(() => {
      updateActivityMutation({
        roomId,
        participantId: participantId as any,
        participantToken,
      }).catch((error) => {
        if (isSessionInvalidError(error)) {
          invalidateRoomSession("Room session expired. Please rejoin.");
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [roomId, participantId, participantToken, updateActivityMutation, isSessionInvalidError, invalidateRoomSession]);

  const generateUploadUrlMutation = useMutation((api as any).messages.generateUploadUrl);

  // Handlers
  const handleSendMessage = async (content: string, type: 'text' | 'image' | 'video' | 'file' | 'audio', file?: File) => {
    if (!encryptionKey) return;
    const attachmentMeta = file && type !== "text" ? validateOutgoingAttachment(type, file) : null;
    if (attachmentMeta && "error" in attachmentMeta) {
      toast.error(attachmentMeta.error);
      return;
    }
    const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const pendingBlobUrl =
      file && (type === "image" || type === "video" || type === "file" || type === "audio")
        ? URL.createObjectURL(file)
        : undefined;

    setPendingMessages((prev) => [
      ...prev,
      {
        _id: pendingId,
        content,
        senderId: participantId,
        senderName: displayName,
        senderAvatar: "",
        createdAt: Date.now(),
        isMe: true,
        isRead: false,
        status: "sending",
        type,
        storageId: pendingBlobUrl,
        fileName: attachmentMeta?.fileName,
        fileSize: file?.size,
        mimeType: attachmentMeta?.mimeType,
        isEncryptedFile: false,
        replyTo: replyTo?._id,
        replyToMessage: replyTo
          ? {
              senderName: replyTo.senderName,
              content: replyTo.content,
              type: replyTo.type,
            }
          : undefined,
      },
    ]);

    try {
      let storageId: string | undefined;
      let encryptedContent = content;
      let linkPreviewEncrypted: string | undefined;

      if (type !== 'text' && file) {
        // ... (existing upload logic)
        // 1. Encrypt File Content
        const fileBuffer = await file.arrayBuffer();
        const encryptedFileBuffer = await ChatCrypto.encryptFile(fileBuffer, encryptionKey);
        const encryptedBlob = new Blob([encryptedFileBuffer], { type: "application/octet-stream" });

        // 2. Get upload URL
        const postUrl = await generateUploadUrlMutation({
          roomId,
          participantId: participantId as any,
          participantToken,
        });
        
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
        encryptedContent = await ChatCrypto.encrypt(content || attachmentMeta?.fileName || file.name, encryptionKey);
      } else {
        encryptedContent = await ChatCrypto.encrypt(content, encryptionKey);
        const firstUrl = room?.settings?.linkPreviewsEnabled === false ? null : firstUrlFromText(content);
        if (firstUrl) {
          try {
            const unfurlResult = await unfurlUrlAction({
              roomId,
              participantId: participantId as any,
              participantToken,
              url: firstUrl,
            });
            const preview = (unfurlResult as any)?.preview;
            if (preview && typeof preview.canonicalUrl === "string") {
              linkPreviewEncrypted = await ChatCrypto.encrypt(
                JSON.stringify({
                  canonicalUrl: preview.canonicalUrl,
                  title: preview.title,
                  description: preview.description,
                  image: preview.image,
                  siteName: preview.siteName,
                }),
                encryptionKey
              );
            }
          } catch (previewError) {
            console.warn("Link preview unfurl failed:", previewError);
          }
        }
      }

      await sendMessageMutation({
        roomId,
        content: encryptedContent,
        encryptionKeyId: "current",
        selfDestruct: room?.settings?.selfDestruct || false,
        participantId: participantId as any,
        participantToken,
        messageType: type,
        storageId,
        fileName: attachmentMeta?.fileName,
        fileSize: file?.size,
        mimeType: attachmentMeta?.mimeType,
        linkPreviewEncrypted,
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
      if (isSessionInvalidError(error)) {
        invalidateRoomSession("Room session expired. Please rejoin.");
        return;
      }
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
        participantToken,
      });
      toast.success("Edited");
    } catch (error) {
      if (isSessionInvalidError(error)) {
        invalidateRoomSession("Room session expired. Please rejoin.");
        return;
      }
      toast.error("Failed to edit");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      await deleteMessageMutation({
        messageId: messageId as any,
        participantId: participantId as any,
        participantToken,
      });
      toast.success("Message deleted");
    } catch (error) {
      if (isSessionInvalidError(error)) {
        invalidateRoomSession("Room session expired. Please rejoin.");
        return;
      }
      toast.error("Failed to delete message");
    }
  };

  const emitTyping = useCallback((typing: boolean) => {
    const now = Date.now();
    if (typing && now - lastTypingSentRef.current < 800) return;
    lastTypingSentRef.current = now;
    setTypingMutation({
      roomId,
      participantId: participantId as any,
      participantToken,
      isTyping: typing,
    }).catch((error) => {
      if (isSessionInvalidError(error)) {
        invalidateRoomSession("Room session expired. Please rejoin.");
      }
    });
  }, [roomId, participantId, participantToken, setTypingMutation, isSessionInvalidError, invalidateRoomSession]);

  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!messageId || messageId.startsWith("pending-")) return;
    const localMessage = displayedMessages.find((message) => String(message._id) === messageId);
    if (!localMessage || localMessage.status === "sending" || localMessage.type === "system") return;

    try {
      const result = await toggleReactionMutation({
        messageId: messageId as any,
        participantId: participantId as any,
        participantToken,
        emoji,
      });

      if ((result as any)?.ignored === true) {
        // Late/stale signals should not mutate local history for this user only.
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("message not found") || message.includes("does not exist")) {
        // Do not locally delete messages on reaction race conditions.
        return;
      }
      if (isSessionInvalidError(error)) {
        invalidateRoomSession("Room session expired. Please rejoin.");
        return;
      }
      toast.error("Failed to react");
    }
  }, [displayedMessages, participantId, participantToken, toggleReactionMutation, isSessionInvalidError, invalidateRoomSession]);

  const handleLeaveRoom = async () => {
    try {
      await leaveRoomMutation({
        roomId,
        participantId: participantId as any,
        participantToken,
      });
      localStorage.removeItem(`room_session_${roomId}`);
      navigate("/");
    } catch (error) {
      if (isSessionInvalidError(error)) {
        invalidateRoomSession("Room session expired. Please rejoin.");
        return;
      }
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
      await kickParticipantMutation({
        roomId,
        participantId: participantIdToKick as any,
        callerParticipantId: participantId as any,
        callerParticipantToken: participantToken,
      });
      toast.success("Member removed");
    } catch (error: any) {
      if (isSessionInvalidError(error)) {
        invalidateRoomSession("Room session expired. Please rejoin.");
        return;
      }
      toast.error(error?.message || "Failed to remove member");
    }
  };

  const handlePanicMode = async () => {
    if (!window.confirm("Destroy room permanently?")) return;
    try {
      await clearParticipantsMutation({
        roomId,
        callerParticipantId: participantId as any,
        callerParticipantToken: participantToken,
        panic: true,
      });
      localStorage.removeItem(`room_session_${roomId}`);
      navigate("/");
    } catch (error) {
      if (isSessionInvalidError(error)) {
        invalidateRoomSession("Room session expired. Please rejoin.");
        return;
      }
      toast.error("Failed to panic");
    }
  };

  const handleClearMembers = async () => {
    try {
      await clearParticipantsMutation({
        roomId,
        callerParticipantId: participantId as any,
        callerParticipantToken: participantToken,
        panic: false,
      });
    } catch (error) {
      if (isSessionInvalidError(error)) {
        invalidateRoomSession("Room session expired. Please rejoin.");
        return;
      }
      toast.error("Failed to clear room members");
    }
  };

  // Call Logic
  const activeCallList = activeCall as Doc<"calls">[] | undefined;
  const currentActiveCall = activeCallList?.find(c => c.status === "active" || c.status === "ringing");
  const callerParticipantId = (currentActiveCall as any)?.createdByParticipantId as string | undefined;
  const callerName = participants?.find((p: any) => p._id === callerParticipantId)?.displayName || "Someone";
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
    return me?.role === "admin";
  }, [participants, participantId]);

  const mappedParticipants = (participants || []).map((p: any) => ({
    id: p._id,
    name: p.displayName,
    avatar: p.avatar,
    isOnline: p.isActive,
    isTyping: p.isTyping && (p.typingUpdatedAt ?? 0) > Date.now() - 4000
  }));

  if (room === undefined) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (room === null) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verifying room state...
      </div>
    );
  }

  return (
    <ScreenShield watermarkText={`${roomId} • ${displayName}`} className="h-screen w-full">
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
            toast.info(`${video ? "Video" : "Voice"} calling is coming soon.`);
          }}
          isAdmin={isAdmin}
          onLeaveRoom={handleLeaveRoom}
          onDeleteRoom={handlePanicMode}
          onCopyInvite={handleCopyInvite}
          onClearMembers={handleClearMembers}
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
          if (!CONFIG.callPreflight.canStartCalls) {
            toast.error(
              CONFIG.callPreflight.missingCallInfraReason ||
                "Calls are unavailable because call infrastructure is not configured."
            );
            return;
          }
          sessionStorage.setItem("call_display_name", displayName);
          sessionStorage.setItem("call_room_id", roomId);
          sessionStorage.setItem("call_video_mode", "0");
          captureCallReturnPath(roomId);
          setDismissedCallIds(prev => new Set(prev).add(currentActiveCall._id));
          navigate(`/call/${currentActiveCall._id}`);
        }}
        onRejectIncoming={async () => {
          if (!currentActiveCall) return;
          rejectInviteMutation({
            callId: currentActiveCall._id,
            roomParticipantId: participantId as any,
            roomParticipantToken: participantToken,
            displayName,
          }).catch(console.error);
          setDismissedCallIds(prev => new Set(prev).add(currentActiveCall._id));
        }}
      />
    </ScreenShield>
  );
}



