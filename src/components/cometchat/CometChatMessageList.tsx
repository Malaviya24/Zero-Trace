import React, { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CheckCheck, Clock3, Reply, FileIcon, Download, Play, Pause } from "lucide-react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/app/AppUI";
import { useSwipeable } from "react-swipeable";
import { ChatCrypto } from "@/lib/crypto";
import { segmentTextWithLinks } from "@/lib/url-utils";

export interface Message {
  _id: string;
  content: string;
  senderId?: string;
  senderName: string;
  senderAvatar?: string;
  createdAt: number;
  isMe: boolean;
  isRead?: boolean;
  status?: "sending" | "sent";
  type: "text" | "image" | "video" | "file" | "system" | "audio";
  reactions?: Array<{ emoji: string; count: number; reactedByMe: boolean }>;
  storageId?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  isEncryptedFile?: boolean;
  replyTo?: string;
  replyToMessage?: {
    senderName: string;
    content: string;
    type: "text" | "image" | "video" | "file" | "system" | "audio";
  };
  linkPreview?: {
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    canonicalUrl: string;
  };
}

interface CometChatMessageListProps {
  messages: Message[];
  onReact?: (messageId: string, emoji: string) => void;
  onReply?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  encryptionKey?: CryptoKey;
}

function triggerBrowserDownload(url: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function sanitizeAttachmentName(fileName: string | undefined, fallback: string) {
  const candidate = Array.from((fileName || "").split(/[\\/]/).pop() || "").filter((char) => { const code = char.charCodeAt(0); return code >= 32 && code !== 127; }).join("").trim();
  if (!candidate) return fallback;
  return candidate.slice(0, 255);
}

function defaultAttachmentName(message: Message) {
  const normalizedMimeType = (message.mimeType || "").toLowerCase();
  const fallback =
    normalizedMimeType.startsWith("audio/") || message.type === "audio"
      ? `audio-${message._id}.bin`
      : message.type === "image"
        ? `image-${message._id}.bin`
        : message.type === "video"
          ? `video-${message._id}.bin`
          : `file-${message._id}.bin`;
  return sanitizeAttachmentName(message.fileName, fallback);
}

function isAudioMimeType(mimeType: string | undefined) {
  return (mimeType || "").toLowerCase().startsWith("audio/");
}

const WHATSAPP_REACTIONS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F64F}"];

function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

async function downloadMessageAttachment(message: Message, encryptionKey?: CryptoKey) {
  if (!message.storageId) throw new Error("Missing attachment URL");
  const response = await fetch(message.storageId);
  if (!response.ok) throw new Error("Failed to download attachment");

  let blob: Blob;
  if (!message.isEncryptedFile || !encryptionKey) {
    blob = await response.blob();
  } else {
    const encryptedBuffer = await response.arrayBuffer();
    const decryptedBuffer = await ChatCrypto.decryptFile(encryptedBuffer, encryptionKey);
    blob = new Blob([decryptedBuffer], {
      type: message.mimeType || "application/octet-stream",
    });
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    triggerBrowserDownload(objectUrl, defaultAttachmentName(message));
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  }
}

function renderLinkedText(content: string) {
  const segments = segmentTextWithLinks(content);
  return segments.map((segment, index) => {
    if (segment.type === "text") {
      return <React.Fragment key={`txt-${index}`}>{segment.value}</React.Fragment>;
    }
    return (
      <a
        key={`lnk-${index}`}
        href={segment.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#dfe104] underline decoration-[#dfe104]/60 underline-offset-2 hover:text-[#eef07a]"
      >
        {segment.value}
      </a>
    );
  });
}

export function CometChatMessageList({
  messages,
  onReact,
  onReply,
  onDelete,
  onEdit,
  encryptionKey,
}: CometChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const groupedMessages = useMemo(() => {
    return messages.reduce((acc, message) => {
      const date = format(message.createdAt, "yyyy-MM-dd");
      if (!acc[date]) acc[date] = [];
      acc[date].push(message);
      return acc;
    }, {} as Record<string, Message[]>);
  }, [messages]);


  return (
    <div
      className="room-canvas flex-1 overflow-y-auto space-y-8 px-3 py-4 scroll-smooth md:px-5 md:py-5"

    >
      {Object.entries(groupedMessages).map(([date, dateMessages]) => (
        <div key={date} className="space-y-6">
          <div className="flex items-center justify-center sticky top-2 z-10">
            <span className="border border-[#3f3f46] bg-[#111217] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#a1a1aa]">
              {format(new Date(date), "MMMM d, yyyy")}
            </span>
          </div>

          <div className="space-y-1">
            {dateMessages.map((message, index) => {
              const isFirstInGroup = index === 0 || dateMessages[index - 1].senderId !== message.senderId;
              return (
                <MessageBubble
                  key={message._id}
                  message={message}
                  isFirstInGroup={isFirstInGroup}
                  onReact={onReact}
                  onReply={onReply}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  encryptionKey={encryptionKey}
                />
              );
            })}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function MessageBubble({
  message,
  isFirstInGroup,
  onReact,
  onReply,
  onDelete,
  onEdit,
  encryptionKey,
}: {
  message: Message;
  isFirstInGroup: boolean;
  onReact?: (id: string, emoji: string) => void;
  onReply?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, newContent: string) => void;
  encryptionKey?: CryptoKey;
}) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const effectiveType =
    message.type === "file" && isAudioMimeType(message.mimeType)
      ? "audio"
      : message.type;
  const displayUrl = message.isEncryptedFile ? decryptedUrl : message.storageId;
  const canInteract = message.status !== "sending";

  useEffect(() => {
    const previewableType =
      effectiveType === "image" ||
      effectiveType === "video" ||
      effectiveType === "audio";

    if (!message.storageId || !message.isEncryptedFile || !encryptionKey || !previewableType) return;

    let isMounted = true;
    let objectUrl: string | null = null;
    const fetchAndDecrypt = async () => {
      try {
        const response = await fetch(message.storageId!);
        if (!response.ok) throw new Error("Download failed");
        const encryptedBuffer = await response.arrayBuffer();
        const decryptedBuffer = await ChatCrypto.decryptFile(encryptedBuffer, encryptionKey);
        const blob = new Blob([decryptedBuffer], { type: message.mimeType || "application/octet-stream" });
        objectUrl = URL.createObjectURL(blob);
        if (isMounted) setDecryptedUrl(objectUrl);
      } catch (error) {
        console.error("Failed to decrypt file:", error);
      }
    };
    fetchAndDecrypt();
    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [effectiveType, message.storageId, message.isEncryptedFile, message.mimeType, encryptionKey]);

  const downloadCurrentAttachment = useCallback(() => {
    void (async () => {
      if (!displayUrl && !message.storageId) return;
      if (displayUrl) {
        triggerBrowserDownload(displayUrl, defaultAttachmentName(message));
        return;
      }
      await downloadMessageAttachment(message, encryptionKey);
    })();
  }, [displayUrl, message, encryptionKey]);

  useEffect(() => {
    if (effectiveType !== "audio") return;
    const element = audioRef.current;
    if (!element) return;
    setAudioPlaying(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setAudioError(null);

    const handleTimeUpdate = () => setAudioCurrentTime(element.currentTime || 0);
    const handleLoadedMetadata = () => {
      setAudioDuration(element.duration || 0);
      setAudioError(null);
    };
    const handlePlay = () => setAudioPlaying(true);
    const handlePause = () => setAudioPlaying(false);
    const handleEnded = () => {
      setAudioPlaying(false);
      setAudioCurrentTime(0);
    };
    const handleError = () => {
      setAudioPlaying(false);
      setAudioError("Audio preview unavailable in this browser.");
    };

    element.addEventListener("timeupdate", handleTimeUpdate);
    element.addEventListener("loadedmetadata", handleLoadedMetadata);
    element.addEventListener("play", handlePlay);
    element.addEventListener("pause", handlePause);
    element.addEventListener("ended", handleEnded);
    element.addEventListener("error", handleError);

    return () => {
      element.removeEventListener("timeupdate", handleTimeUpdate);
      element.removeEventListener("loadedmetadata", handleLoadedMetadata);
      element.removeEventListener("play", handlePlay);
      element.removeEventListener("pause", handlePause);
      element.removeEventListener("ended", handleEnded);
      element.removeEventListener("error", handleError);
    };
  }, [effectiveType, displayUrl]);

  const handleToggleAudioPlayback = useCallback(() => {
    if (effectiveType !== "audio") return;
    const element = audioRef.current;
    if (!element || !displayUrl) return;

    if (audioPlaying) {
      element.pause();
      return;
    }

    element.play().catch(() => {
      setAudioError("Tap play again or use download if playback is blocked.");
    });
  }, [audioPlaying, displayUrl, effectiveType]);

  const handleAudioSeek = useCallback((value: number) => {
    const element = audioRef.current;
    if (!element || !Number.isFinite(value)) return;
    element.currentTime = value;
    setAudioCurrentTime(value);
  }, []);

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      if (!canInteract) return;
      if (eventData.dir === "Right") {
        setSwipeOffset(Math.min(eventData.deltaX, 100));
      }
    },
    onSwipedRight: (eventData) => {
      if (!canInteract) return;
      if (eventData.deltaX > 50) {
        onReply?.(message._id);
      }
      setSwipeOffset(0);
    },
    onSwiped: () => {
      setSwipeOffset(0);
    },
    trackMouse: true,
  });

  const handleTouchStart = () => {
    if (!canInteract) return;
    const timer = setTimeout(() => {
      setShowReactionPicker(true);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleEditClick = () => {
    if (!onEdit) return;
    const next = window.prompt("Edit message", message.content);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === message.content) return;
    onEdit(message._id, trimmed);
  };

  if (message.type === "system") {
    return (
      <div className="flex justify-center my-4">
        <span className="border border-[#3f3f46] bg-[#111217] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#a1a1aa]">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div
      id={`message-${message._id}`}
      className={cn(
        "flex w-full group relative mb-1 select-none animate-in fade-in slide-in-from-bottom-1 duration-200",
        message.isMe ? "justify-end" : "justify-start"
      )}
      {...handlers}
      style={{ transform: `translateX(${swipeOffset}px)`, transition: swipeOffset === 0 ? "transform 0.2s ease-out" : "none" }}
    >
      <div
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 flex items-center justify-center transition-opacity duration-300",
          swipeOffset > 40 ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="border border-[#3f3f46] bg-[#111217] p-2">
          <Reply className="h-4 w-4 text-[#dfe104]" />
        </div>
      </div>

      <div className={cn("relative max-w-[85%] md:max-w-[70%]", message.reactions && message.reactions.length > 0 && "mb-3")}>
        {showReactionPicker ? (
          <>
            <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setShowReactionPicker(false)} />
            <div
              className={cn(
                "absolute -top-14 z-50 flex items-center gap-1 border-2 border-[#3f3f46] bg-[#09090b] p-1.5 animate-in zoom-in-50 duration-200",
                message.isMe ? "right-0" : "left-0"
              )}
            >
              {WHATSAPP_REACTIONS.map((emoji) => {
                const isReacted = message.reactions?.some((reaction) => reaction.emoji === emoji && reaction.reactedByMe);
                return (
                  <button
                    key={emoji}
                    className={cn(
                      "p-1.5 text-xl leading-none transition-transform hover:scale-125",
                      isReacted ? "bg-[#dfe104]/20" : "hover:bg-[#18181b]"
                    )}
                    onClick={() => {
                      onReact?.(message._id, emoji);
                      setShowReactionPicker(false);
                    }}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        <div
          className={cn(
            "relative flex flex-col border-2",
            message.isMe
              ? "border-[#dfe104] bg-[#dfe104] text-black"
              : "border-[#3f3f46] bg-[#111217] text-[#fafafa]",
            isFirstInGroup && !message.isMe && "rounded-tl-none",
            isFirstInGroup && message.isMe && "rounded-tr-none"
          )}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onContextMenu={(event) => {
            if (!canInteract) return;
            event.preventDefault();
            setShowReactionPicker(true);
          }}
        >
          {message.replyToMessage ? (
            <div
              className="mx-2 mt-2 mb-1 cursor-pointer border-l-4 border-[#dfe104] bg-black/10 px-2 py-2 transition-colors hover:bg-black/15"
              onClick={() => {
                const element = document.getElementById(`message-${message.replyTo}`);
                element?.scrollIntoView({ behavior: "smooth", block: "center" });
                element?.classList.add("highlight-message");
                setTimeout(() => element?.classList.remove("highlight-message"), 2000);
              }}
            >
              <div className="text-xs font-medium text-primary mb-0.5">{message.replyToMessage.senderName}</div>
              <div className="text-xs opacity-70 truncate max-w-[220px]">
                {message.replyToMessage.type === "image"
                  ? "📷 Photo"
                  : message.replyToMessage.type === "video"
                  ? "🎬 Video"
                  : message.replyToMessage.type === "file"
                  ? "📄 File"
                  : message.replyToMessage.type === "audio"
                  ? "🎤 Voice Message"
                  : message.replyToMessage.content}
              </div>
            </div>
          ) : null}

          {!message.isMe && isFirstInGroup ? (
            <span className="cursor-pointer px-3 pt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#dfe104] hover:underline">
              {message.senderName}
            </span>
          ) : null}

          <div
            className={cn(
              "min-w-[96px] px-3 py-3 text-[14px] leading-6",
              effectiveType === "image" && "p-1",
              effectiveType === "video" && "p-1"
            )}
          >
            {effectiveType === "text" ? (
              <div className="whitespace-pre-wrap break-words">{renderLinkedText(message.content)}</div>
            ) : null}

            {effectiveType === "text" && message.linkPreview ? (
              <a
                href={message.linkPreview.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block border border-current/20 bg-black/10 p-3 transition hover:bg-black/15"
              >
                {message.linkPreview.image ? (
                  <img
                    src={message.linkPreview.image}
                    alt={message.linkPreview.title || "Link preview image"}
                    className="mb-2 max-h-44 w-full rounded-md object-cover"
                  />
                ) : null}
                <p className="truncate text-sm font-bold uppercase tracking-[0.08em]">
                  {message.linkPreview.title || message.linkPreview.canonicalUrl}
                </p>
                {message.linkPreview.description ? (
                  <p className="mt-1 line-clamp-2 text-xs opacity-80">
                    {message.linkPreview.description}
                  </p>
                ) : null}
                <p className="mt-2 truncate text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">
                  {message.linkPreview.siteName ||
                    (() => {
                      try {
                        return new URL(message.linkPreview.canonicalUrl).hostname;
                      } catch {
                        return message.linkPreview.canonicalUrl;
                      }
                    })()}
                </p>
              </a>
            ) : null}

            {effectiveType === "image" ? (
              <div className="relative group/image mb-1">
                {displayUrl ? (
                  <>
                    <img
                      src={displayUrl}
                      alt={message.content || "Image"}
                      className="max-h-[320px] max-w-full cursor-pointer border border-current/20 object-cover"
                      onClick={() => window.open(displayUrl, "_blank")}
                    />
                    <button
                      type="button"
                      onClick={downloadCurrentAttachment}
                      className="absolute right-2 top-2 border border-[#3f3f46] bg-[#09090b]/90 p-1.5 text-[#fafafa] opacity-0 transition group-hover/image:opacity-100"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex h-48 w-64 items-center justify-center border border-current/20 bg-black/10 text-current/70">
                    <FileIcon className="h-10 w-10" />
                  </div>
                )}
                {message.content && message.content !== message.fileName ? <p className="mt-1 text-sm">{message.content}</p> : null}
              </div>
            ) : null}

            {effectiveType === "video" ? (
              <div className="relative group/video mb-1">
                {displayUrl ? (
                  <>
                    <video src={displayUrl} controls className="max-h-[320px] max-w-full border border-current/20 bg-black" preload="metadata" />
                    <button
                      type="button"
                      onClick={downloadCurrentAttachment}
                      className="absolute right-2 top-2 border border-[#3f3f46] bg-[#09090b]/90 p-1.5 text-[#fafafa] opacity-0 transition group-hover/video:opacity-100"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex h-48 w-64 items-center justify-center border border-current/20 bg-black/10 text-current/70">
                    <FileIcon className="h-10 w-10" />
                  </div>
                )}
                {message.content && message.content !== message.fileName ? <p className="mt-1 text-sm">{message.content}</p> : null}
              </div>
            ) : null}

            {effectiveType === "file" ? (
              <button
                type="button"
                onClick={downloadCurrentAttachment}
                className="mb-1 flex w-full items-center gap-3 border border-current/20 bg-black/10 p-3 text-left transition hover:bg-black/15"
              >
                <div className="border border-current/20 bg-black/20 p-2">
                  <FileIcon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{message.fileName || "File"}</p>
                  <p className="text-xs opacity-60">
                    {message.fileSize ? `${(message.fileSize / 1024).toFixed(0)} KB` : "File"} �{" "}
                    {message.mimeType?.split("/")[1]?.toUpperCase() || "BIN"}
                  </p>
                </div>
                {message.storageId ? (
                  <span className="p-2">
                    <Download className="h-5 w-5 opacity-70" />
                  </span>
                ) : null}
              </button>
            ) : null}

            {effectiveType === "audio" ? (
              <div className="min-w-[260px] max-w-[340px] py-1">
                <audio ref={audioRef} src={displayUrl || undefined} preload="metadata" />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 rounded-none border border-current/20 bg-black/10 text-current hover:bg-black/20"
                    onClick={handleToggleAudioPlayback}
                    disabled={!displayUrl}
                  >
                    {audioPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 ml-0.5 fill-current" />}
                  </Button>

                  <div className="flex-1">
                    <input
                      type="range"
                      min={0}
                      max={Math.max(audioDuration, 1)}
                      value={Math.min(audioCurrentTime, Math.max(audioDuration, 1))}
                      onChange={(event) => handleAudioSeek(Number(event.target.value))}
                      className="h-1.5 w-full cursor-pointer accent-[#dfe104]"
                      disabled={!displayUrl}
                    />
                    <div className="mt-1 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] opacity-70">
                      <span>{formatAudioTime(audioCurrentTime)}</span>
                      <span>{formatAudioTime(audioDuration)}</span>
                    </div>
                  </div>

                  {displayUrl ? (
                    <button type="button" className="p-2" onClick={downloadCurrentAttachment}>
                      <Download className="h-5 w-5 opacity-70" />
                    </button>
                  ) : null}
                </div>

                {audioError ? (
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-amber-300">{audioError}</p>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-1 select-none float-right mt-1 ml-2 relative top-[2px]">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-70">
                {format(message.createdAt, "h:mm a")}
              </span>
              {message.isMe ? (
                message.status === "sending" ? (
                  <span className="ml-0.5 text-[#8696a0] animate-pulse">
                    <Clock3 className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <span className={cn("ml-0.5", message.isRead ? "text-black/70" : "text-black/50")}>
                    <CheckCheck className="h-3.5 w-3.5" />
                  </span>
                )
              ) : null}
            </div>
          </div>

          {message.reactions && message.reactions.length > 0 ? (
            <div
              className={cn(
                "absolute -bottom-3 z-10 flex items-center gap-1 border border-[#3f3f46] bg-[#09090b] px-2 py-1",
                message.isMe ? "right-2" : "left-2"
              )}
              onClick={() => setShowReactionPicker(true)}
            >
              {message.reactions.slice(0, 3).map((reaction, index) => (
                <span key={index} className="text-[10px] leading-none">
                  {reaction.emoji}
                </span>
              ))}
              {message.reactions.length > 1 ? (
                <span className="ml-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#a1a1aa]">
                  {message.reactions.reduce((total, reaction) => total + reaction.count, 0)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {canInteract ? (
          <div className="absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-6 w-6 rounded-full bg-black/20 text-white text-xs">⋮</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={message.isMe ? "end" : "start"} className="w-36 rounded-none border-2 border-[#3f3f46] bg-[#09090b] text-[#fafafa]">
                <DropdownMenuItem onClick={() => onReply?.(message._id)}>Reply</DropdownMenuItem>
                {message.type === "text" && message.isMe ? (
                  <DropdownMenuItem onClick={handleEditClick}>Edit</DropdownMenuItem>
                ) : null}
                {message.isMe ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => onDelete?.(message._id)}>
                      Delete
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>
    </div>
  );
}








