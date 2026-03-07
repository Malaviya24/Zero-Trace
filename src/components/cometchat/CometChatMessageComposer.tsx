import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Send,
  Paperclip,
  Smile,
  Mic,
  Image as ImageIcon,
  X,
  Loader2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

export interface CometChatMessageComposerProps {
  onSend: (
    content: string,
    type: "text" | "image" | "file" | "audio",
    file?: File
  ) => Promise<void> | void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  replyTo?: {
    senderName: string;
    content: string;
    type: "text" | "image" | "file" | "audio" | "system";
  } | null;
  onCancelReply?: () => void;
}

export function CometChatMessageComposer({
  onSend,
  onTyping,
  disabled,
  replyTo,
  onCancelReply,
}: CometChatMessageComposerProps) {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSendingText, setIsSendingText] = useState(false);
  const [isSendingAttachment, setIsSendingAttachment] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    type: "image" | "file";
  } | null>(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    if (!pendingAttachment || pendingAttachment.type !== "image") {
      setAttachmentPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(pendingAttachment.file);
    setAttachmentPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [pendingAttachment]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isSendingText) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    if (!isTyping) {
      setIsTyping(true);
      onTyping?.(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      onTyping?.(false);
    }, 1000);
  };

  const handleSend = async () => {
    if (!message.trim() || isSendingText) return;

    setIsSendingText(true);
    try {
      await onSend(message, "text");
      setMessage("");
      setIsTyping(false);
      onTyping?.(false);
    } finally {
      setIsSendingText(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSendingAttachment || disabled) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const type = file.type.startsWith("image/") ? "image" : "file";
    setPendingAttachment({ file, type });
  };

  const handleAttachmentConfirm = async () => {
    if (!pendingAttachment || isSendingAttachment) return;

    setIsSendingAttachment(true);
    try {
      await onSend(
        pendingAttachment.file.name,
        pendingAttachment.type,
        pendingAttachment.file
      );
      clearPendingAttachment();
    } finally {
      setIsSendingAttachment(false);
    }
  };

  const clearPendingAttachment = () => {
    setPendingAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleMicClick = async () => {
    if (isSendingText || isSendingAttachment) return;

    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        onTyping?.(false);
      }
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Microphone not supported.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, {
          type: "audio/webm",
        });
        void onSend("Voice Message", "audio", file);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      onTyping?.(true);
    } catch (err) {
      console.error("Mic error:", err);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setMessage((prev) => prev + emojiData.emoji);
  };

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
      <div className="bg-[#f0f2f5] dark:bg-[#202c33] p-2 border-t border-slate-200 dark:border-slate-800 relative z-20">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileUpload}
        />

        {replyTo && (
          <div className="mb-2 bg-slate-100 dark:bg-slate-800 p-2 border-l-4 border-primary shadow-sm flex items-center justify-between z-10 animate-in slide-in-from-bottom-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-primary mb-0.5">{replyTo.senderName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {replyTo.type === "image"
                  ? "Photo"
                  : replyTo.type === "file"
                    ? "File"
                    : replyTo.type === "audio"
                      ? "Voice Message"
                      : replyTo.content}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancelReply}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {pendingAttachment && (
          <div className="mb-2 rounded-xl border border-slate-200/80 dark:border-slate-700/70 bg-white/80 dark:bg-[#2a3942] p-2 flex items-center gap-3 animate-in slide-in-from-bottom-2 fade-in-0">
            {pendingAttachment.type === "image" && attachmentPreviewUrl ? (
              <img
                src={attachmentPreviewUrl}
                alt="Attachment preview"
                className="h-16 w-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg border border-slate-200 dark:border-slate-700 bg-primary/10 text-primary flex items-center justify-center">
                <FileText className="h-7 w-7" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{pendingAttachment.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {pendingAttachment.type === "image" ? "Photo" : "File"} • {formatFileSize(pendingAttachment.file.size)}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-slate-100"
                onClick={clearPendingAttachment}
                disabled={isSendingAttachment}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90"
                onClick={() => void handleAttachmentConfirm()}
                disabled={isSendingAttachment}
              >
                {isSendingAttachment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-0.5" />
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
        <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-2xl flex items-end shadow-sm border border-slate-200/50 dark:border-slate-700/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all duration-200">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                disabled={isSendingAttachment || disabled}
              >
                <Paperclip className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-48 p-2">
              <div className="grid gap-1">
                <Button
                  variant="ghost"
                  className="justify-start gap-2"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = "image/*";
                      fileInputRef.current.click();
                    }
                  }}
                >
                  <ImageIcon className="h-4 w-4" /> Photo
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start gap-2"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = "*/*";
                      fileInputRef.current.click();
                    }
                  }}
                >
                  <Paperclip className="h-4 w-4" /> File
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex-1 min-h-[40px] py-2">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="min-h-[24px] max-h-[120px] w-full resize-none border-none bg-transparent p-0 focus-visible:ring-0 placeholder:text-slate-400"
              rows={1}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center gap-1 pb-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-600">
                  <Smile className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" className="w-full p-0 border-none">
                <EmojiPicker onEmojiClick={onEmojiClick} />
              </PopoverContent>
            </Popover>

            {message.trim() ? (
              <Button
                onClick={() => void handleSend()}
                disabled={disabled || isSendingText}
                size="icon"
                className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all duration-200 hover:scale-105"
              >
                {isSendingText ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-0.5" />
                )}
              </Button>
            ) : (
              <Button
                disabled={disabled || isSendingText || isSendingAttachment}
                variant="ghost"
                size="icon"
                className={cn(
                  "h-10 w-10 rounded-full transition-all duration-300",
                  isRecording
                    ? "bg-red-500 text-white hover:bg-red-600 animate-pulse"
                    : "text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                )}
                onClick={handleMicClick}
              >
                <Mic className={cn("h-5 w-5", isRecording && "fill-current")} />
              </Button>
            )}
          </div>
        </div>
        </div>
      </div>
  );
}
