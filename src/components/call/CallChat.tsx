import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@/lib/convex-helpers";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface CallChatProps {
  roomId?: string;
  displayName: string;
  className?: string;
}

export function CallChat({ roomId, displayName, className }: CallChatProps) {
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const resolvedRoomId = roomId || sessionStorage.getItem("call_room_id") || undefined;
  const participantId = resolvedRoomId
    ? (() => {
        try {
          const raw = localStorage.getItem(`room_session_${resolvedRoomId}`);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          return typeof parsed?.participantId === "string" ? parsed.participantId : null;
        } catch {
          return null;
        }
      })()
    : null;
  const participantToken = resolvedRoomId
    ? (() => {
        try {
          const raw = localStorage.getItem(`room_session_${resolvedRoomId}`);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          return typeof parsed?.participantToken === "string" ? parsed.participantToken : null;
        } catch {
          return null;
        }
      })()
    : null;
  
  const messages = useQuery(
    (api as any).messages.getRoomMessages,
    resolvedRoomId && participantId && participantToken
      ? {
          roomId: resolvedRoomId,
          participantId: participantId as Id<"participants">,
          participantToken,
          limit: 500,
        }
      : "skip"
  );
  
  const sendMessageMutation = useMutation((api as any).messages.sendMessage);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !resolvedRoomId || !participantId || !participantToken) return;

    try {
      await sendMessageMutation({
        roomId: resolvedRoomId,
        content: message.trim(),
        encryptionKeyId: "call-chat",
        participantId: participantId as Id<"participants">,
        participantToken,
      });
      setMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-card border-l", className)}>
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <h3 className="font-semibold">Chat</h3>
          {messages && messages.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {messages.length}
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3">
          {!resolvedRoomId ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              Chat is only available for calls within a room
            </div>
          ) : messages && messages.length > 0 ? (
            messages.map((msg: any) => (
              <div
                key={msg._id}
                className={cn(
                  "flex flex-col gap-1 p-3 rounded-lg max-w-[85%]",
                  msg.senderName === displayName
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">
                    {msg.senderName === displayName ? "You" : msg.senderName}
                  </span>
                  <span className="text-xs opacity-70">
                    {new Date(msg._creationTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm break-words">{msg.content}</p>
              </div>
            ))
          ) : (
            <div className="text-center text-muted-foreground text-sm py-8">
              No messages yet. Start the conversation!
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            id="call-chat-input"
            name="call-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={resolvedRoomId ? "Type a message..." : "Chat unavailable"}
            disabled={!resolvedRoomId}
            className="flex-1"
            autoComplete="off"
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || !resolvedRoomId || !participantId || !participantToken}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
