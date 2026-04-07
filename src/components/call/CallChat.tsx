import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";

import { Badge, Button, Input, ScrollArea } from "@/components/app/AppUI";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "@/lib/convex-helpers";
import { cn } from "@/lib/utils";

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

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn("flex h-full flex-col bg-[#09090b] text-[#fafafa] [font-family:Space_Grotesk,_Inter,_sans-serif]", className)}>
      <div className="border-b-2 border-[#3f3f46] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center border-2 border-[#3f3f46] bg-[#18181b] text-[#dfe104]">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold uppercase tracking-[-0.04em]">Call chat</h3>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a1a1aa]">Room-linked messages</p>
          </div>
          {messages && messages.length > 0 ? (
            <Badge className="ml-auto rounded-none border border-[#3f3f46] bg-[#18181b] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a1a1aa] hover:bg-[#18181b]">
              {messages.length}
            </Badge>
          ) : null}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3">
          {!resolvedRoomId ? (
            <div className="border border-[#3f3f46] bg-[#111217] px-4 py-6 text-center text-sm uppercase tracking-[0.14em] text-[#a1a1aa]">
              Chat is only available for calls inside a room.
            </div>
          ) : messages && messages.length > 0 ? (
            messages.map((msg: any) => (
              <div
                key={msg._id}
                className={cn(
                  "flex max-w-[88%] flex-col gap-2 border p-3",
                  msg.senderName === displayName
                    ? "ml-auto border-[#dfe104] bg-[#dfe104] text-black"
                    : "border-[#3f3f46] bg-[#111217] text-[#fafafa]"
                )}
              >
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] opacity-75">
                  <span>{msg.senderName === displayName ? "You" : msg.senderName}</span>
                  <span>
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
            <div className="border border-[#3f3f46] bg-[#111217] px-4 py-6 text-center text-sm uppercase tracking-[0.14em] text-[#a1a1aa]">
              No messages yet. Start the conversation.
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t-2 border-[#3f3f46] p-4">
        <div className="flex gap-2 border-2 border-[#3f3f46] bg-[#111217] p-2">
          <Input
            id="call-chat-input"
            name="call-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={resolvedRoomId ? "Type a message" : "Chat unavailable"}
            disabled={!resolvedRoomId}
            className="h-12 flex-1 rounded-none border-0 bg-transparent text-sm font-medium text-[#fafafa] placeholder:text-[#52525b] focus-visible:ring-0"
            autoComplete="off"
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || !resolvedRoomId || !participantId || !participantToken}
            size="icon"
            className="h-12 w-12 rounded-none border-2 border-[#dfe104] bg-[#dfe104] text-black hover:bg-[#d3d53c]"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}


