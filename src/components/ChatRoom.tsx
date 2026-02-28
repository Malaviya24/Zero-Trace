import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { ChatCrypto } from "@/lib/crypto";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  AlertTriangle,
  Check,
  CheckCheck,
  Loader2,
} from "lucide-react";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@/lib/convex-helpers";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ParticipantSidebar } from "@/components/chat/ParticipantSidebar";
import { MessageInput } from "@/components/chat/MessageInput";
import { TypingBubble } from "@/components/chat/TypingBubble";
import { CallNotification } from "@/components/call/CallNotification";
import { Button } from "@/components/ui/button";

interface Message {
  _id: Id<"messages">;
  senderName: string;
  senderAvatar: string;
  content: string;
  messageType: "text" | "system" | "join" | "leave";
  isRead: boolean;
  readAt?: number;
  selfDestructAt?: number;
  _creationTime: number;
  encryptionKeyId: string;
  senderId?: Id<"users">;
}

interface ChatRoomProps {
  roomId: string;
  displayName: string;
  avatar: string;
  encryptionKey: CryptoKey;
  participantId: string;
}

export default function ChatRoom({ roomId, displayName, avatar, encryptionKey, participantId }: ChatRoomProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const room = useQuery((api as any).rooms.getRoomByRoomId, { roomId });
  const participants = useQuery((api as any).rooms.getRoomParticipants, { roomId });
  const messages = useQuery((api as any).messages.getRoomMessages, { roomId, limit: 100 });
  const activeCall = useQuery((api as any).calls.listByRoom, { roomId });

  const sendMessageMutation = useMutation((api as any).messages.sendMessage);
  const editMessageMutation = useMutation((api as any).messages.editMessage);
  const markReadMutation = useMutation((api as any).messages.markMessageRead);
  const leaveRoomMutation = useMutation((api as any).rooms.leaveRoom);
  const clearMessagesMutation = useMutation((api as any).messages.clearRoomMessages);
  const updateActivityMutation = useMutation((api as any).rooms.updateActivity);
  const kickParticipantMutation = useMutation((api as any).rooms.kickParticipant);
  const clearParticipantsMutation = useMutation((api as any).rooms.clearParticipants);
  const setTypingMutation = useMutation((api as any).rooms.setTyping);

  useEffect(() => {
    if (!roomId || !displayName || !encryptionKey || !participantId) {
      console.error("ChatRoom: Missing required props", { roomId, displayName, hasKey: !!encryptionKey, participantId });
      toast.error("Invalid room session. Please rejoin the room.");
      navigate("/");
    }
  }, [roomId, displayName, encryptionKey, participantId, navigate]);

  const [panicMode, setPanicMode] = useState(false);
  const [keyRotationCount, setKeyRotationCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [dismissedCallIds, setDismissedCallIds] = useState<Set<string>>(new Set());
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [isClearingMembers, setIsClearingMembers] = useState(false);
  const [isCopyingInvite, setIsCopyingInvite] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const enableDark = saved ? saved === "dark" : prefersDark;
    setIsDark(enableDark);
    if (enableDark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    const root = document.documentElement;
    if (next) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  useEffect(() => {
    if (!participants || !participantId) return;
    const meStillPresent = (participants as any[]).some(
      (p: any) => p._id === (participantId as any)
    );
    if (!meStillPresent) {
      toast.error("You have been removed by the admin.");
      const sessionKey = `room_session_${roomId}`;
      try { localStorage.removeItem(sessionKey); } catch (e) { console.error("Failed to clear session:", e); }
      navigate("/");
    }
  }, [participants, participantId, navigate, roomId]);

  // Add: Redirect if room is deleted (Panic Mode)
  useEffect(() => {
    if (room === null) {
      toast.error("Room has been destroyed.");
      const sessionKey = `room_session_${roomId}`;
      try { localStorage.removeItem(sessionKey); } catch (e) {}
      navigate("/");
    }
  }, [room, navigate, roomId]);

  const safeMarkRead = useCallback(
    async (messageId: Id<"messages">) => {
      try { await markReadMutation({ messageId }); } catch (e) { console.error("Failed to mark message as read:", e); }
    },
    [markReadMutation]
  );

  const isAdmin = useMemo(() => {
    const list = participants || [];
    const me = list.find((p: any) => p._id === (participantId as any));
    if (me?.role === "admin") return true;
    return !!(user && room?.creatorId && user._id === room.creatorId);
  }, [participants, participantId, user, room]);

  const adminParticipant = useMemo(() => {
    const list = participants || [];
    const byCreator = list.find((p: any) => room?.creatorId && p.userId === room.creatorId);
    return byCreator || list.find((p: any) => p.role === "admin") || null;
  }, [participants, room]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const interval = setInterval(() => {
      updateActivityMutation({ roomId }).catch((e: any) => {
        console.error("Failed to update activity:", e);
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [roomId, updateActivityMutation]);

  const handlePanicMode = useCallback(async () => {
    setPanicMode(true);
    setIsClearing(true);
    try {
      // Consolidate into a single "Nuclear Panic" mutation that deletes everything
      await clearParticipantsMutation({ 
        roomId, 
        callerParticipantId: participantId as any 
      });
      
      const sessionKey = `room_session_${roomId}`;
      try { localStorage.removeItem(sessionKey); } catch (e) {}
      
      toast.success("Room destroyed permanently");
      navigate("/");
    } catch (error) {
      console.error("Panic mode error:", error);
      toast.error("Failed to execute panic mode");
    } finally {
      setIsClearing(false);
    }
  }, [clearParticipantsMutation, roomId, navigate, participantId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handlePanicMode();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePanicMode]);

  const handleSendMessage = async (messageText: string) => {
    if (!encryptionKey) return;
    try {
      setIsSending(true);
      const encryptedContent = await ChatCrypto.encrypt(messageText, encryptionKey);
      if (editingMessage) {
        await editMessageMutation({
          messageId: editingMessage.id as any,
          content: encryptedContent,
          participantId: participantId as any,
        });
        setEditingMessage(null);
        toast.success("Message edited");
      } else {
        await sendMessageMutation({
          roomId,
          content: encryptedContent,
          encryptionKeyId: "current",
          selfDestruct: room?.settings?.selfDestruct || false,
          participantId: participantId as any,
        });
        setKeyRotationCount(prev => prev + 1);
        if (keyRotationCount >= 50) {
          setKeyRotationCount(0);
          toast.info("Encryption key rotated for enhanced security");
        }
      }
      emitTyping(false);
    } catch (error) {
      console.error("Send/edit message error:", error);
      toast.error(editingMessage ? "Failed to edit message" : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleEditMessage = async (messageId: string, currentContent: string) => {
    try {
      const decrypted = await ChatCrypto.decrypt(currentContent, encryptionKey);
      setEditingMessage({ id: messageId, content: decrypted });
    } catch (error) {
      console.error("Failed to decrypt message for editing:", error);
      toast.error("Unable to edit this message");
    }
  };

  const handleLeaveRoom = async () => {
    try {
      setIsLeaving(true);
      await leaveRoomMutation({ roomId, participantId: participantId as any });
      localStorage.removeItem(`room_session_${roomId}`);
      navigate("/");
    } catch (error) {
      console.error("Leave room error:", error);
      toast.error("Failed to leave room");
    } finally {
      setIsLeaving(false);
    }
  };

  const handleCopyInvite = async () => {
    try {
      setIsCopyingInvite(true);
      const exportedKey = await ChatCrypto.exportKey(encryptionKey);
      const linkWithKey = `${window.location.origin}/join/${roomId}#k=${encodeURIComponent(exportedKey)}`;
      await navigator.clipboard.writeText(linkWithKey);
      toast.success("Invite link copied!");
    } catch (e) {
      toast.error("Unable to export key for invite.");
    } finally {
      setIsCopyingInvite(false);
    }
  };

  // Keep session alive across refreshes - do NOT clear on beforeunload
  // Session is only cleared when user explicitly leaves the room

  const lastTypingSentRef = useRef<number>(0);
  const emitTyping = useCallback(
    (typing: boolean) => {
      const now = Date.now();
      if (typing && now - lastTypingSentRef.current < 800) return;
      lastTypingSentRef.current = now;
      setTypingMutation({ roomId, isTyping: typing }).catch((e: any) => {
        console.error("Failed to update typing status:", e);
      });
    },
    [roomId, setTypingMutation]
  );

  const typingUsers = useMemo(() => {
    const now = Date.now();
    const active = (participants || []).filter(
      (p: any) =>
        p.isActive &&
        p.displayName !== displayName &&
        p.isTyping &&
        (p.typingUpdatedAt ?? 0) > now - 4000
    );
    return active.slice(0, 3).map((p: any) => p.displayName);
  }, [participants, displayName]);

  const handleKick = async (participantIdToKick: string) => {
    try {
      setKickingId(participantIdToKick as any);
      await kickParticipantMutation({ roomId, participantId: participantIdToKick as any, callerParticipantId: participantId as any });
      toast.success("Member removed");
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove member");
    } finally {
      setKickingId(null);
    }
  };

  const handleClearMembers = async () => {
    try {
      setIsClearingMembers(true);
      await clearParticipantsMutation({ roomId, callerParticipantId: participantId as any });
      toast.success("Members cleared");
    } catch (e: any) {
      toast.error(e?.message || "Failed to clear members");
    } finally {
      setIsClearingMembers(false);
    }
  };

  const currentActiveCall = activeCall?.find(
    (call: any) => call.status === "ringing" || call.status === "active"
  );
  const shouldShowCallNotification = currentActiveCall && !dismissedCallIds.has(currentActiveCall._id);
  const handleDismissCallNotification = () => {
    if (currentActiveCall) {
      setDismissedCallIds(prev => new Set(prev).add(currentActiveCall._id));
    }
  };

  if (!room) {
    return (
      <div className="h-dvh flex items-center justify-center bg-background">
        <div className="text-center p-8 max-w-sm">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-bold mb-2">Room Not Found</h2>
          <p className="text-muted-foreground mb-6 text-sm">
            This room may have expired or doesn't exist.
          </p>
          <Button onClick={() => navigate("/")} className="w-full">
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      {shouldShowCallNotification && (
        <CallNotification
          callId={currentActiveCall._id}
          callerName={
            participants?.find((p: any) => p.userId === currentActiveCall.createdBy)?.displayName || 
            "Someone"
          }
          roomId={roomId}
          displayName={displayName}
          onDismiss={handleDismissCallNotification}
        />
      )}

      <ChatHeader
        roomId={roomId}
        displayName={displayName}
        participants={participants || []}
        adminParticipant={adminParticipant}
        isAdmin={isAdmin}
        isDark={isDark}
        isCopyingInvite={isCopyingInvite}
        isClearing={isClearing}
        isClearingMembers={isClearingMembers}
        isLeaving={isLeaving}
        kickingId={kickingId}
        onCopyInvite={handleCopyInvite}
        onPanicMode={handlePanicMode}
        onClearMembers={handleClearMembers}
        onLeaveRoom={handleLeaveRoom}
        onToggleTheme={toggleTheme}
        onKick={handleKick}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto chat-wallpaper"
          >
            <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 space-y-1">
              {(!messages || messages.length === 0) && (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Shield className="h-8 w-8 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground/70">Messages are end-to-end encrypted</p>
                    <p className="text-xs text-muted-foreground mt-1">Send a message to start chatting</p>
                  </div>
                </div>
              )}

              <AnimatePresence>
                {messages?.map((msg: Message, index: number) => {
                  const prevMsg = index > 0 ? messages[index - 1] : null;
                  const showAvatar = !prevMsg || prevMsg.senderName !== msg.senderName || prevMsg.messageType !== "text";
                  return (
                    <MessageBubble
                      key={msg._id}
                      message={msg}
                      encryptionKey={encryptionKey}
                      isOwn={msg.senderName === displayName}
                      onMarkRead={() => safeMarkRead(msg._id)}
                      onEdit={handleEditMessage}
                      adminUserId={room?.creatorId as Id<"users"> | undefined}
                      showAvatar={showAvatar}
                    />
                  );
                })}
              </AnimatePresence>
              <TypingBubble typingUsers={typingUsers} />
              <div ref={messagesEndRef} />
            </div>
          </div>

          <MessageInput
            onSendMessage={handleSendMessage}
            onTypingChange={emitTyping}
            isSending={isSending}
            editingMessage={editingMessage}
            onCancelEdit={() => setEditingMessage(null)}
          />
        </div>

        <ParticipantSidebar
          participants={participants || []}
          isAdmin={isAdmin}
          onKick={handleKick}
          kickingId={kickingId}
          roomId={roomId}
        />
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  encryptionKey,
  isOwn,
  onMarkRead,
  onEdit,
  adminUserId,
  showAvatar,
}: {
  message: Message;
  encryptionKey: CryptoKey;
  isOwn: boolean;
  onMarkRead: () => void;
  onEdit: (messageId: string, content: string) => void;
  adminUserId?: Id<"users">;
  showAvatar: boolean;
}) {
  const [decryptedContent, setDecryptedContent] = useState<string>("");
  const [isVisible, setIsVisible] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    const decryptMessage = async () => {
      if (message.messageType !== "text") {
        setDecryptedContent(message.content);
        return;
      }
      try {
        const decrypted = await ChatCrypto.decrypt(message.content, encryptionKey);
        setDecryptedContent(decrypted);
      } catch (error) {
        setDecryptedContent("[Unable to decrypt message]");
      }
    };
    decryptMessage();
  }, [message, encryptionKey]);

  useEffect(() => {
    if (!message.selfDestructAt) return;
    const interval = setInterval(() => {
      const remaining = message.selfDestructAt! - Date.now();
      if (remaining <= 0) {
        setTimeLeft(0);
        clearInterval(interval);
      } else {
        setTimeLeft(Math.ceil(remaining / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [message.selfDestructAt]);

  useEffect(() => {
    if (isVisible && !message.isRead && !isOwn) {
      onMarkRead();
    }
  }, [isVisible, message.isRead, isOwn, onMarkRead]);

  if (message.messageType === "system" || message.messageType === "join" || message.messageType === "leave") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="flex justify-center py-1"
      >
        <span className="text-[11px] text-muted-foreground bg-secondary/80 dark:bg-muted/60 px-3 py-1 rounded-lg shadow-sm backdrop-blur-sm">
          {decryptedContent}
        </span>
      </motion.div>
    );
  }

  const isAdminSender = adminUserId && message.senderId && message.senderId === adminUserId;
  const timeStr = new Date(message._creationTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`flex ${isOwn ? "justify-end" : "justify-start"} ${showAvatar ? "mt-2" : "mt-0.5"}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onTouchStart={() => setShowActions(true)}
    >
      <div className={`flex items-end gap-1.5 max-w-[85%] sm:max-w-[70%] ${isOwn ? "flex-row-reverse" : ""}`}>
        {!isOwn && (
          <div className="flex-shrink-0 w-7 mb-0.5">
            {showAvatar ? (
              <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center">
                <span className="text-sm">{message.senderAvatar}</span>
              </div>
            ) : null}
          </div>
        )}

        <div className="relative group">
          {isOwn && showActions && message.messageType === "text" && (
            <button
              onClick={() => onEdit(message._id, message.content)}
              className="absolute -left-8 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-secondary hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10 shadow-sm"
              aria-label="Edit message"
            >
              <span className="text-xs">✏️</span>
            </button>
          )}

          <div
            className={[
              "px-3 py-1.5 shadow-sm relative",
              isOwn
                ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md"
                : "bg-card dark:bg-muted/50 text-foreground border border-border/50 rounded-2xl rounded-bl-md",
            ].join(" ")}
          >
            {showAvatar && !isOwn && (
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-xs font-semibold ${isAdminSender ? "text-primary" : "text-primary/80"}`}>
                  {message.senderName}
                </span>
                {isAdminSender && (
                  <Badge
                    variant="outline"
                    className="h-3.5 text-[8px] px-1 py-0 rounded-full border-primary/30 text-primary bg-primary/10 inline-flex items-center gap-0.5"
                  >
                    <Shield className="h-2 w-2" />
                  </Badge>
                )}
              </div>
            )}

            <p className="text-[13px] sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
              {decryptedContent}
            </p>

            <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? "justify-end" : "justify-end"}`}>
              {(message as any).editedAt && (
                <span className={`text-[10px] italic ${isOwn ? "text-primary-foreground/50" : "text-muted-foreground/60"}`}>edited</span>
              )}
              {timeLeft !== null && (
                <span className="text-[10px] text-destructive font-mono">{timeLeft}s</span>
              )}
              <time className={`text-[10px] ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground/50"} font-mono tabular-nums`}>
                {timeStr}
              </time>
              {isOwn && (
                <span className="ml-0.5">
                  {message.isRead ? (
                    <CheckCheck className={`h-3.5 w-3.5 ${isOwn ? "text-blue-200" : "text-blue-500"}`} />
                  ) : (
                    <Check className={`h-3.5 w-3.5 ${isOwn ? "text-primary-foreground/50" : "text-muted-foreground/40"}`} />
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
