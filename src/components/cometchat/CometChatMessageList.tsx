import React, { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CheckCheck, Clock3, Reply, FileIcon, Download, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  roomId: string;
  messages: Message[];
  onReact?: (messageId: string, emoji: string) => void;
  onReply?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  encryptionKey?: CryptoKey;
}

type QueueItem = {
  messageId: string;
  fileName: string;
  queuedAt: number;
};
const DOWNLOAD_BATCH_CONCURRENCY = 3;

const WHATSAPP_REACTIONS = [
  "\u{1F44D}", // 👍
  "\u2764\uFE0F", // ❤️
  "\u{1F602}", // 😂
  "\u{1F62E}", // 😮
  "\u{1F622}", // 😢
  "\u{1F64F}", // 🙏
];

function queueKey(roomId: string) {
  return `download_queue_${roomId}`;
}

function readQueue(roomId: string): QueueItem[] {
  try {
    const raw = localStorage.getItem(queueKey(roomId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.messageId === "string" &&
        typeof item.fileName === "string" &&
        typeof item.queuedAt === "number"
    );
  } catch {
    return [];
  }
}

function saveQueue(roomId: string, items: QueueItem[]) {
  try {
    localStorage.setItem(queueKey(roomId), JSON.stringify(items));
  } catch {
    // Ignore storage errors to avoid blocking chat.
  }
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

function defaultAttachmentName(message: Message) {
  if (message.fileName?.trim()) return message.fileName;
  if (message.type === "image") return `image-${message._id}.bin`;
  if (message.type === "video") return `video-${message._id}.bin`;
  if (message.type === "audio") return `audio-${message._id}.bin`;
  return `file-${message._id}.bin`;
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
        className="text-[#1d4ed8] underline decoration-[#1d4ed8]/50 underline-offset-2 hover:text-[#1e40af]"
      >
        {segment.value}
      </a>
    );
  });
}

export function CometChatMessageList({
  roomId,
  messages,
  onReact,
  onReply,
  onDelete,
  onEdit,
  encryptionKey,
}: CometChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [pendingQueue, setPendingQueue] = useState<QueueItem[]>(() => readQueue(roomId));
  const attemptedAutoDownloadIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setPendingQueue(readQueue(roomId));
  }, [roomId]);

  useEffect(() => {
    saveQueue(roomId, pendingQueue);
  }, [roomId, pendingQueue]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const groupedMessages = useMemo(() => {
    return messages.reduce((acc, message) => {
      const date = format(message.createdAt, "yyyy-MM-dd");
      if (!acc[date]) acc[date] = [];
      acc[date].push(message);
      return acc;
    }, {} as Record<string, Message[]>);
  }, [messages]);

  const queueDownload = useCallback((message: Message) => {
    setPendingQueue((prev) => {
      if (prev.some((item) => item.messageId === message._id)) return prev;
      return [
        ...prev,
        {
          messageId: message._id,
          fileName: defaultAttachmentName(message),
          queuedAt: Date.now(),
        },
      ];
    });
  }, []);

  const clearQueued = useCallback((messageId: string) => {
    setPendingQueue((prev) => prev.filter((item) => item.messageId !== messageId));
  }, []);

  const handleDownloadAllPending = useCallback(async () => {
    const byId = new Map(messages.map((message) => [message._id, message]));
    const failed = new Set<string>();
    const items = [...pendingQueue];
    let cursor = 0;

    const worker = async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        const item = items[index];
        const message = byId.get(item.messageId);
        if (!message || !message.storageId) {
          continue;
        }
        try {
          await downloadMessageAttachment(message, encryptionKey);
        } catch {
          failed.add(item.messageId);
        }
      }
    };

    const workerCount = Math.max(1, Math.min(DOWNLOAD_BATCH_CONCURRENCY, items.length));
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    setPendingQueue((prev) => prev.filter((item) => failed.has(item.messageId)));
  }, [messages, pendingQueue, encryptionKey]);

  const hasAutoAttempted = useCallback((messageId: string) => attemptedAutoDownloadIdsRef.current.has(messageId), []);
  const markAutoAttempted = useCallback((messageId: string) => {
    attemptedAutoDownloadIdsRef.current.add(messageId);
  }, []);

  return (
    <div
      className="flex-1 overflow-y-auto p-4 space-y-6 bg-[#efe7dd] dark:bg-[#0b141a] scroll-smooth"
      style={{
        backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
        backgroundBlendMode: "overlay",
      }}
    >
      {pendingQueue.length > 0 ? (
        <div className="sticky top-2 z-20 flex justify-center">
          <div className="rounded-full border border-slate-200/80 bg-white/95 px-3 py-1.5 shadow dark:border-slate-700 dark:bg-slate-900/95">
            <button
              type="button"
              onClick={() => void handleDownloadAllPending()}
              className="text-xs font-medium text-[#1d4ed8] hover:text-[#1e40af]"
            >
              Download all pending files ({pendingQueue.length})
            </button>
          </div>
        </div>
      ) : null}

      {Object.entries(groupedMessages).map(([date, dateMessages]) => (
        <div key={date} className="space-y-6">
          <div className="flex items-center justify-center sticky top-2 z-10">
            <span className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200/50 dark:border-slate-700/50">
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
                  onQueueDownload={queueDownload}
                  onClearQueued={clearQueued}
                  hasAutoAttempted={hasAutoAttempted}
                  markAutoAttempted={markAutoAttempted}
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
  onQueueDownload,
  onClearQueued,
  hasAutoAttempted,
  markAutoAttempted,
}: {
  message: Message;
  isFirstInGroup: boolean;
  onReact?: (id: string, emoji: string) => void;
  onReply?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, newContent: string) => void;
  encryptionKey?: CryptoKey;
  onQueueDownload: (message: Message) => void;
  onClearQueued: (messageId: string) => void;
  hasAutoAttempted: (messageId: string) => boolean;
  markAutoAttempted: (messageId: string) => void;
}) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!message.storageId || !message.isEncryptedFile || !encryptionKey) return;

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
  }, [message.storageId, message.isEncryptedFile, message.mimeType, encryptionKey]);

  const displayUrl = message.isEncryptedFile ? decryptedUrl : message.storageId;
  const canInteract = message.status !== "sending";
  const isAttachment = message.type === "image" || message.type === "video" || message.type === "file" || message.type === "audio";

  const downloadCurrentAttachment = useCallback(() => {
    void (async () => {
      if (!displayUrl && !message.storageId) return;
      onQueueDownload(message);
      try {
        if (displayUrl) {
          triggerBrowserDownload(displayUrl, defaultAttachmentName(message));
        } else {
          await downloadMessageAttachment(message, encryptionKey);
        }
        onClearQueued(message._id);
      } catch {
        onQueueDownload(message);
      }
    })();
  }, [displayUrl, message, onQueueDownload, onClearQueued, encryptionKey]);

  useEffect(() => {
    if (!displayUrl || !isAttachment || message.isMe || !canInteract) return;
    if (hasAutoAttempted(message._id)) return;
    markAutoAttempted(message._id);
    // Always queue first for auto-download attempts. Browsers may silently block
    // background downloads, so we keep a guaranteed manual recovery path.
    onQueueDownload(message);
    try {
      triggerBrowserDownload(displayUrl, defaultAttachmentName(message));
    } catch {
      // Queue already populated above.
    }
  }, [displayUrl, isAttachment, message, canInteract, onQueueDownload, hasAutoAttempted, markAutoAttempted]);

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
        <span className="text-xs text-slate-500 bg-[#e3e6e8] dark:bg-[#1f2c34] px-3 py-1 rounded-full shadow-sm opacity-80">
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
        <div className="bg-white dark:bg-slate-800 rounded-full p-2 shadow-md">
          <Reply className="h-4 w-4 text-primary" />
        </div>
      </div>

      <div className={cn("relative max-w-[85%] md:max-w-[70%]", message.reactions && message.reactions.length > 0 && "mb-3")}>
        {showReactionPicker ? (
          <>
            <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setShowReactionPicker(false)} />
            <div
              className={cn(
                "absolute -top-12 z-50 bg-white dark:bg-slate-800 rounded-full shadow-xl p-1.5 flex items-center gap-1 animate-in zoom-in-50 duration-200 border border-slate-100 dark:border-slate-700",
                message.isMe ? "right-0" : "left-0"
              )}
            >
              {WHATSAPP_REACTIONS.map((emoji) => {
                const isReacted = message.reactions?.some((reaction) => reaction.emoji === emoji && reaction.reactedByMe);
                return (
                  <button
                    key={emoji}
                    className={cn(
                      "hover:scale-125 transition-transform p-1.5 rounded-full text-xl leading-none",
                      isReacted ? "bg-primary/10" : "hover:bg-slate-100 dark:hover:bg-slate-700"
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
            "flex flex-col relative shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]",
            message.isMe
              ? "bg-[#d9fdd3] dark:bg-[#005c4b] rounded-l-lg rounded-br-lg rounded-tr-none"
              : "bg-white dark:bg-[#202c33] rounded-r-lg rounded-bl-lg rounded-tl-none",
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
              className="mb-1 mx-1 p-1 rounded bg-black/5 dark:bg-white/5 border-l-4 border-primary/50 cursor-pointer hover:bg-black/10 transition-colors"
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
            <span className="text-[13px] font-medium text-[#d85834] px-2 pt-1 pb-0.5 leading-none cursor-pointer hover:underline">
              {message.senderName}
            </span>
          ) : null}

          <div
            className={cn(
              "px-2 py-1.5 text-[14.2px] text-[#111b21] dark:text-[#e9edef] leading-[19px] min-w-[80px]",
              message.type === "image" && "p-1",
              message.type === "video" && "p-1"
            )}
          >
            {message.type === "text" ? (
              <div className="whitespace-pre-wrap break-words">{renderLinkedText(message.content)}</div>
            ) : null}

            {message.type === "text" && message.linkPreview ? (
              <a
                href={message.linkPreview.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block rounded-lg border border-slate-300/80 bg-white/80 p-2 transition hover:bg-white dark:border-slate-600 dark:bg-slate-900/40 dark:hover:bg-slate-900/60"
              >
                {message.linkPreview.image ? (
                  <img
                    src={message.linkPreview.image}
                    alt={message.linkPreview.title || "Link preview image"}
                    className="mb-2 max-h-44 w-full rounded-md object-cover"
                  />
                ) : null}
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {message.linkPreview.title || message.linkPreview.canonicalUrl}
                </p>
                {message.linkPreview.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                    {message.linkPreview.description}
                  </p>
                ) : null}
                <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
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

            {message.type === "image" ? (
              <div className="relative group/image mb-1">
                {displayUrl ? (
                  <>
                    <img
                      src={displayUrl}
                      alt={message.content || "Image"}
                      className="rounded-lg object-cover cursor-pointer max-w-full max-h-[320px]"
                      onClick={() => window.open(displayUrl, "_blank")}
                    />
                    <button
                      type="button"
                      onClick={downloadCurrentAttachment}
                      className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-white opacity-0 transition group-hover/image:opacity-100"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-48 w-64 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400">
                    <FileIcon className="h-10 w-10" />
                  </div>
                )}
                {message.content && message.content !== message.fileName ? <p className="mt-1 text-sm">{message.content}</p> : null}
              </div>
            ) : null}

            {message.type === "video" ? (
              <div className="relative group/video mb-1">
                {displayUrl ? (
                  <>
                    <video src={displayUrl} controls className="rounded-lg max-w-full max-h-[320px] bg-black" preload="metadata" />
                    <button
                      type="button"
                      onClick={downloadCurrentAttachment}
                      className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-white opacity-0 transition group-hover/video:opacity-100"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-48 w-64 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400">
                    <FileIcon className="h-10 w-10" />
                  </div>
                )}
                {message.content && message.content !== message.fileName ? <p className="mt-1 text-sm">{message.content}</p> : null}
              </div>
            ) : null}

            {message.type === "file" ? (
              <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-2 rounded-md mb-1">
                <div className="bg-[#f06d6d] text-white p-2 rounded-lg">
                  <FileIcon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{message.fileName || "File"}</p>
                  <p className="text-xs opacity-60">
                    {message.fileSize ? `${(message.fileSize / 1024).toFixed(0)} KB` : "File"} •{" "}
                    {message.mimeType?.split("/")[1]?.toUpperCase() || "BIN"}
                  </p>
                </div>
                {displayUrl ? (
                  <button type="button" className="p-2" onClick={downloadCurrentAttachment}>
                    <Download className="h-5 w-5 opacity-70" />
                  </button>
                ) : null}
              </div>
            ) : null}

            {message.type === "audio" ? (
              <div className="flex items-center gap-2 min-w-[240px] py-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700"
                  onClick={() => {
                    if (!displayUrl) return;
                    const audio = new Audio(displayUrl);
                    audio.play().catch(() => {});
                  }}
                >
                  <Play className="h-5 w-5 ml-1 fill-current" />
                </Button>
                {displayUrl ? (
                  <audio controls className="h-10 max-w-[220px]" src={displayUrl} preload="metadata" />
                ) : null}
                {displayUrl ? (
                  <button type="button" className="p-2" onClick={downloadCurrentAttachment}>
                    <Download className="h-5 w-5 opacity-70" />
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-1 select-none float-right mt-1 ml-2 relative top-[2px]">
              <span className="text-[11px] text-[#667781] dark:text-[#8696a0]">
                {format(message.createdAt, "h:mm a")}
              </span>
              {message.isMe ? (
                message.status === "sending" ? (
                  <span className="ml-0.5 text-[#8696a0] animate-pulse">
                    <Clock3 className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <span className={cn("ml-0.5", message.isRead ? "text-[#53bdeb]" : "text-[#8696a0]")}>
                    <CheckCheck className="h-3.5 w-3.5" />
                  </span>
                )
              ) : null}
            </div>
          </div>

          {message.reactions && message.reactions.length > 0 ? (
            <div
              className={cn(
                "absolute -bottom-3 z-10 flex items-center gap-0.5 bg-white dark:bg-[#202c33] rounded-full px-1 py-0.5 shadow-sm border border-slate-100 dark:border-[#202c33]",
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
                <span className="text-[10px] text-slate-500 ml-0.5">
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
              <DropdownMenuContent align={message.isMe ? "end" : "start"} className="w-32">
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
