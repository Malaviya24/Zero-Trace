import React, { useCallback, useEffect, useRef, useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
  Send,
  Paperclip,
  Smile,
  Mic,
  Image as ImageIcon,
  Music,
  Video,
  X,
  Loader2,
  FileText,
  Trash2,
} from "lucide-react";
import { SiteButton, SiteTextarea } from "@/components/site/SitePrimitives";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { toast } from "sonner";

export interface CometChatMessageComposerProps {
  onSend: (
    content: string,
    type: "text" | "image" | "video" | "file" | "audio",
    file?: File
  ) => Promise<void> | void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  replyTo?: {
    senderName: string;
    content: string;
    type: "text" | "image" | "video" | "file" | "audio" | "system";
  } | null;
  onCancelReply?: () => void;
}

function getSupportedAudioMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "audio/webm";
  }

  const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return mimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "audio/webm";
}

function formatRecordingDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [recordingDurationSeconds, setRecordingDurationSeconds] = useState(0);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    type: "image" | "video" | "file" | "audio";
  } | null>(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingActionRef = useRef<"cancel" | "send" | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pendingAttachment || (pendingAttachment.type !== "image" && pendingAttachment.type !== "video")) {
      setAttachmentPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(pendingAttachment.file);
    setAttachmentPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [pendingAttachment]);

  useEffect(() => {
    if (!isRecording || !recordingStartedAt) return;

    const interval = window.setInterval(() => {
      setRecordingDurationSeconds(Math.max(0, Math.floor((Date.now() - recordingStartedAt) / 1000)));
    }, 250);

    return () => window.clearInterval(interval);
  }, [isRecording, recordingStartedAt]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) {
        setShowAttachmentMenu(false);
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, []);

  const stopTyping = useCallback(() => {
    setIsTyping(false);
    onTyping?.(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [onTyping]);

  const resetRecordingState = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    recordingActionRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setRecordingStartedAt(null);
    setRecordingDurationSeconds(0);
    stopTyping();
  }, [stopTyping]);

  useEffect(() => {
    return () => {
      resetRecordingState();
    };
  }, [resetRecordingState]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isSendingText) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);

    if (!isTyping) {
      setIsTyping(true);
      onTyping?.(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1000);
  };

  const handleSend = async () => {
    if (!message.trim() || isSendingText) return;

    setIsSendingText(true);
    try {
      await onSend(message, "text");
      setMessage("");
      stopTyping();
    } finally {
      setIsSendingText(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isSendingAttachment || disabled) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const normalizedMimeType = (file.type || "").toLowerCase();
    const type = normalizedMimeType.startsWith("image/")
      ? "image"
      : normalizedMimeType.startsWith("video/")
      ? "video"
      : normalizedMimeType.startsWith("audio/")
      ? "audio"
      : "file";
    setPendingAttachment({ file, type });
    setShowAttachmentMenu(false);
  };

  const handleAttachmentConfirm = async () => {
    if (!pendingAttachment || isSendingAttachment) return;

    setIsSendingAttachment(true);
    try {
      await onSend(pendingAttachment.file.name, pendingAttachment.type, pendingAttachment.file);
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

  const handleStartRecording = async () => {
    if (disabled || isSendingText || isSendingAttachment || isRecording) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Microphone recording is not supported in this browser.");
      return;
    }

    try {
      setShowAttachmentMenu(false);
      setShowEmojiPicker(false);
      clearPendingAttachment();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recordingActionRef.current = null;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const stopAction = recordingActionRef.current;
        const finalMimeType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalMimeType });
        resetRecordingState();

        if (stopAction !== "send" || blob.size === 0) {
          return;
        }

        const extension = finalMimeType.includes("ogg") ? "ogg" : finalMimeType.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice-note-${Date.now()}.${extension}`, { type: finalMimeType });

        void (async () => {
          setIsSendingAttachment(true);
          try {
            await onSend("Voice message", "audio", file);
          } finally {
            setIsSendingAttachment(false);
          }
        })();
      };

      recorder.start();
      setRecordingStartedAt(Date.now());
      setRecordingDurationSeconds(0);
      setIsRecording(true);
      onTyping?.(true);
    } catch (error) {
      console.error("Mic error:", error);
      toast.error("Microphone access was denied or is unavailable.");
      resetRecordingState();
    }
  };

  const handleCancelRecording = () => {
    recordingActionRef.current = "cancel";
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
      return;
    }
    resetRecordingState();
  };

  const handleSendRecording = () => {
    recordingActionRef.current = "send";
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
      return;
    }
    resetRecordingState();
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setMessage((current) => current + emojiData.emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const openFilePicker = (accept: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  const actionMenuButton = "justify-start border-transparent bg-transparent px-3 text-[0.72rem] tracking-[0.16em] hover:bg-muted";
  const recordingWave = [0, 1, 2, 3, 4, 5];

  return (
    <div className="border-t-2 border-border bg-background p-3 md:p-4">
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />

      <AnimatePresence initial={false}>
        {replyTo ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-3 flex items-center justify-between border-2 border-border bg-[#111217] px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">Replying to {replyTo.senderName}</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {replyTo.type === "image"
                  ? "Photo"
                  : replyTo.type === "video"
                  ? "Video"
                  : replyTo.type === "file"
                  ? "File"
                  : replyTo.type === "audio"
                  ? "Voice message"
                  : replyTo.content}
              </p>
            </div>
            <SiteButton variant="ghost" size="icon" className="h-9 w-9 border text-foreground hover:bg-muted" onClick={onCancelReply}>
              <X className="h-4 w-4" />
            </SiteButton>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {pendingAttachment ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-3 flex items-center gap-3 border-2 border-border bg-[#111217] p-3"
          >
            {(pendingAttachment.type === "image" || pendingAttachment.type === "video") && attachmentPreviewUrl ? (
              pendingAttachment.type === "image" ? (
                <img src={attachmentPreviewUrl} alt="Attachment preview" className="h-16 w-16 border border-border object-cover" />
              ) : (
                <video src={attachmentPreviewUrl} className="h-16 w-16 border border-border object-cover" muted />
              )
            ) : (
              <div className="flex h-16 w-16 items-center justify-center border border-border bg-muted text-accent">
                <FileText className="h-7 w-7" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold uppercase tracking-[0.08em] text-foreground">{pendingAttachment.file.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {pendingAttachment.type} • {formatFileSize(pendingAttachment.file.size)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <SiteButton
                variant="ghost"
                size="icon"
                className="h-10 w-10 border text-foreground hover:bg-muted"
                onClick={clearPendingAttachment}
                disabled={isSendingAttachment}
              >
                <X className="h-4 w-4" />
              </SiteButton>
              <SiteButton
                size="icon"
                className="h-10 w-10 border-accent px-0"
                onClick={() => void handleAttachmentConfirm()}
                disabled={isSendingAttachment}
              >
                {isSendingAttachment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </SiteButton>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        {isRecording ? (
          <motion.div
            key="recording"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex items-center gap-3 border-2 border-border bg-[#111217] px-3 py-3 md:px-4"
          >
            <SiteButton
              variant="ghost"
              size="icon"
              className="h-11 w-11 border text-red-400 hover:bg-red-500/10"
              onClick={handleCancelRecording}
              disabled={isSendingAttachment}
            >
              <Trash2 className="h-4 w-4" />
            </SiteButton>

            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-red-500/50 bg-red-500/12 text-red-400">
                <Mic className="h-5 w-5 fill-current" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-accent">Recording voice note</p>
                <div className="mt-2 flex items-end gap-1">
                  {recordingWave.map((bar) => (
                    <motion.span
                      key={bar}
                      animate={{ height: [8, 18 + (bar % 2) * 6, 10] }}
                      transition={{ duration: 0.85, repeat: Infinity, ease: "easeInOut", delay: bar * 0.08 }}
                      className="w-1 bg-accent"
                    />
                  ))}
                </div>
              </div>
              <span className="text-sm font-bold uppercase tracking-[0.14em] text-foreground">
                {formatRecordingDuration(recordingDurationSeconds)}
              </span>
            </div>

            <SiteButton
              size="icon"
              className="h-11 w-11 border-accent px-0"
              onClick={handleSendRecording}
              disabled={isSendingAttachment}
            >
              {isSendingAttachment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </SiteButton>
          </motion.div>
        ) : (
          <motion.div
            key="composer"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative flex items-end gap-3 border-2 border-border bg-[#111217] px-3 py-2 md:px-4 md:py-3"
          >
            <div className="relative" ref={attachmentMenuRef}>
              <SiteButton
                variant="ghost"
                size="icon"
                className="h-11 w-11 border border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
                disabled={isSendingAttachment || disabled}
                onClick={() => {
                  setShowAttachmentMenu((current) => !current);
                  setShowEmojiPicker(false);
                }}
              >
                <Paperclip className="h-5 w-5" />
              </SiteButton>
              <AnimatePresence>
                {showAttachmentMenu ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute bottom-[calc(100%+0.75rem)] left-0 z-30 w-52 border-2 border-border bg-background p-2"
                  >
                    <div className="grid gap-1">
                      <SiteButton variant="ghost" className={actionMenuButton} onClick={() => openFilePicker("image/*")}>
                        <ImageIcon className="mr-2 h-4 w-4" /> Photo
                      </SiteButton>
                      <SiteButton variant="ghost" className={actionMenuButton} onClick={() => openFilePicker("video/*")}>
                        <Video className="mr-2 h-4 w-4" /> Video
                      </SiteButton>
                      <SiteButton variant="ghost" className={actionMenuButton} onClick={() => openFilePicker("audio/*")}>
                        <Music className="mr-2 h-4 w-4" /> Audio
                      </SiteButton>
                      <SiteButton variant="ghost" className={actionMenuButton} onClick={() => openFilePicker("*/*")}>
                        <Paperclip className="mr-2 h-4 w-4" /> File
                      </SiteButton>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="min-h-[48px] flex-1 border-l border-border pl-3">
              <SiteTextarea
                ref={textareaRef}
                value={message}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message"
                className="min-h-[48px] max-h-[140px] w-full resize-none border-none bg-transparent p-0 text-sm font-medium normal-case placeholder:normal-case"
                rows={1}
                disabled={disabled}
                displayUppercase={false}
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="relative" ref={emojiPickerRef}>
                <SiteButton
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 border border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
                  onClick={() => {
                    setShowEmojiPicker((current) => !current);
                    setShowAttachmentMenu(false);
                  }}
                >
                  <Smile className="h-5 w-5" />
                </SiteButton>
                <AnimatePresence>
                  {showEmojiPicker ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute bottom-[calc(100%+0.75rem)] right-0 z-30 overflow-hidden border-2 border-border bg-background"
                    >
                      <EmojiPicker onEmojiClick={onEmojiClick} />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              {message.trim() ? (
                <SiteButton
                  onClick={() => void handleSend()}
                  disabled={disabled || isSendingText}
                  size="icon"
                  className="h-11 w-11 border-accent px-0"
                >
                  {isSendingText ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </SiteButton>
              ) : (
                <SiteButton
                  disabled={disabled || isSendingText || isSendingAttachment}
                  size="icon"
                  className="h-11 w-11 border-accent px-0"
                  onClick={handleStartRecording}
                >
                  <Mic className="h-5 w-5" />
                </SiteButton>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
