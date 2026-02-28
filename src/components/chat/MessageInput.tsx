import { Button } from "@/components/ui/button";
import { Send, Loader2, X, Pencil } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface MessageInputProps {
  onSendMessage: (message: string) => Promise<void>;
  onTypingChange: (isTyping: boolean) => void;
  isSending: boolean;
  editingMessage?: { id: string; content: string } | null;
  onCancelEdit?: () => void;
}

export function MessageInput({ 
  onSendMessage, 
  onTypingChange, 
  isSending,
  editingMessage,
  onCancelEdit,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (editingMessage) {
      setMessage(editingMessage.content);
      textareaRef.current?.focus();
    } else {
      setMessage("");
    }
  }, [editingMessage?.id]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [message]);

  const handleMessageChange = (val: string) => {
    setMessage(val);
    onTypingChange(true);
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      onTypingChange(false);
      typingTimeoutRef.current = null;
    }, 1800);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!message.trim() || isSending) return;

    await onSendMessage(message.trim());
    setMessage("");
    onTypingChange(false);
    
    if (editingMessage && onCancelEdit) {
      onCancelEdit();
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCancel = () => {
    setMessage("");
    if (onCancelEdit) {
      onCancelEdit();
    }
  };

  return (
    <div className="pb-[env(safe-area-inset-bottom)]">
      {editingMessage && (
        <div className="mx-3 sm:mx-5 mb-1 px-4 py-2.5 flex items-center gap-3 bg-primary/5 rounded-xl border border-primary/15">
          <div className="w-0.5 h-8 bg-primary rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary flex items-center gap-1.5">
              <Pencil className="h-3 w-3" />
              Editing message
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{editingMessage.content}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="h-7 w-7 rounded-full p-0 flex-shrink-0 hover:bg-destructive/10"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2.5 px-3 sm:px-5 py-3">
        <div className="flex-1 bg-secondary/70 dark:bg-muted/30 rounded-3xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/25 transition-all border border-border/40">
          <textarea
            ref={textareaRef}
            id="message-input"
            name="message"
            value={message}
            onChange={(e) => handleMessageChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={editingMessage ? "Edit your message..." : "Write a Message"}
            className="w-full resize-none bg-transparent px-5 py-3 text-sm placeholder:text-muted-foreground/40 focus:outline-none min-h-[44px] max-h-[120px] leading-relaxed"
            rows={1}
            maxLength={2000}
            autoComplete="off"
          />
        </div>
        <Button
          type="submit"
          disabled={!message.trim() || isSending}
          className="h-11 w-11 rounded-full p-0 flex-shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transition-all disabled:opacity-30"
          aria-label={editingMessage ? "Save edit" : "Send message"}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
