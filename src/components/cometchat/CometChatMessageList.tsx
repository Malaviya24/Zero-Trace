import React, { useRef, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import { CheckCheck, Clock3, SmilePlus, Reply, FileIcon, Download, Play } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSwipeable } from 'react-swipeable';
import EmojiPicker from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { ChatCrypto } from "@/lib/crypto";
// Actually, CometChatRoom passes decrypted messages. But for files, we decided to pass the URL and a flag.
// The key is needed to decrypt the file BLOB.
// Let's assume we pass the key via context or props? 
// Or better: The parent `CometChatRoom` handles the file decryption when the user clicks "Download" or "View".
// But for images, we want them to show inline.
// So `MessageBubble` needs to be able to fetch and decrypt.

// Let's add `encryptionKey` to `CometChatMessageListProps` and pass it down.
interface CometChatMessageListProps {
  messages: Message[];
  onReact?: (messageId: string, emoji: string) => void;
  onReply?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  encryptionKey?: CryptoKey; // Add this
}

export interface Message {
  _id: string;
  content: string;
  senderId?: string;
  senderName: string;
  senderAvatar?: string;
  createdAt: number;
  isMe: boolean;
  isRead?: boolean;
  status?: 'sending' | 'sent';
  type: 'text' | 'image' | 'file' | 'system' | 'audio';
  reactions?: Array<{ emoji: string; count: number; reactedByMe: boolean }>;
  storageId?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  isEncryptedFile?: boolean;
  replyTo?: string; // ID of the parent message
  replyToMessage?: { // Resolved parent content
    senderName: string;
    content: string;
    type: 'text' | 'image' | 'file' | 'system' | 'audio';
  };
}

const WHATSAPP_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function CometChatMessageList({
  messages,
  onReact,
  onReply,
  onDelete,
  onEdit,
  encryptionKey
}: CometChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Group messages by date
  const groupedMessages = messages.reduce((acc, message) => {
    const date = format(message.createdAt, 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(message);
    return acc;
  }, {} as Record<string, Message[]>);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[#efe7dd] dark:bg-[#0b141a] scroll-smooth" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundBlendMode: 'overlay' }}>
      {Object.entries(groupedMessages).map(([date, dateMessages]) => (
        <div key={date} className="space-y-6">
          {/* Date Separator */}
          <div className="flex items-center justify-center sticky top-2 z-10">
            <span className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200/50 dark:border-slate-700/50">
              {format(new Date(date), 'MMMM d, yyyy')}
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
  encryptionKey
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
      } catch (err) {
        console.error("Failed to decrypt file:", err);
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

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      if (!canInteract) return;
      if (message.isMe) return; // Only swipe incoming messages for reply (WhatsApp style) - actually WhatsApp allows both, implementing generic swipe right
      if (eventData.dir === 'Right') {
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
    trackMouse: true
  });

  const handleTouchStart = () => {
    if (!canInteract) return;
    const timer = setTimeout(() => {
      setShowReactionPicker(true);
    }, 500); // 500ms long press
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

  if (message.type === 'system') {
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
      style={{ transform: `translateX(${swipeOffset}px)`, transition: swipeOffset === 0 ? 'transform 0.2s ease-out' : 'none' }}
    >
      {/* Reply Icon Indicator */}
      <div className={cn(
        "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 flex items-center justify-center transition-opacity duration-300",
        swipeOffset > 40 ? "opacity-100" : "opacity-0"
      )}>
        <div className="bg-white dark:bg-slate-800 rounded-full p-2 shadow-md">
           <Reply className="h-5 w-5 text-slate-500" />
        </div>
      </div>

      <div className={cn(
        "flex max-w-[85%] md:max-w-[65%] relative group/bubble",
        message.isMe ? "flex-row-reverse" : "flex-row"
      )}>
        
        {/* Reaction Picker Overlay */}
        {showReactionPicker && (
          <>
            <div 
              className="fixed inset-0 z-40 bg-black/20" 
              onClick={() => setShowReactionPicker(false)}
            />
            <div className={cn(
              "absolute -top-12 z-50 bg-white dark:bg-slate-800 rounded-full shadow-xl p-1.5 flex items-center gap-1 animate-in zoom-in-50 duration-200 border border-slate-100 dark:border-slate-700",
              message.isMe ? "right-0" : "left-0"
            )}>
              {WHATSAPP_REACTIONS.map((emoji) => {
                const isReacted = message.reactions?.some(r => r.emoji === emoji && r.reactedByMe);
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
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
              <Popover>
                <PopoverTrigger asChild>
                  <button 
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500"
                  >
                    <SmilePlus className="h-5 w-5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 border-none" align="center" side="top">
                  <EmojiPicker 
                    onEmojiClick={(emojiData) => {
                      onReact?.(message._id, emojiData.emoji);
                      setShowReactionPicker(false);
                    }}
                    width={300}
                    height={400}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </>
        )}

        <div 
          className={cn(
            "flex flex-col relative shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]",
            message.isMe 
              ? "bg-[#d9fdd3] dark:bg-[#005c4b] rounded-l-lg rounded-br-lg rounded-tr-none" 
              : "bg-white dark:bg-[#202c33] rounded-r-lg rounded-bl-lg rounded-tl-none",
            isFirstInGroup && !message.isMe && "rounded-tl-none", // Tail logic could be refined
            isFirstInGroup && message.isMe && "rounded-tr-none"
          )}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onContextMenu={(e) => {
            if (!canInteract) return;
            e.preventDefault();
            setShowReactionPicker(true);
          }}
        >
          {/* Reply Preview */}
          {message.replyToMessage && (
            <div 
              className="mb-1 mx-1 p-1 rounded bg-black/5 dark:bg-white/5 border-l-4 border-primary/50 cursor-pointer hover:bg-black/10 transition-colors"
              onClick={() => {
                const el = document.getElementById(`message-${message.replyTo}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el?.classList.add('highlight-message');
                setTimeout(() => el?.classList.remove('highlight-message'), 2000);
              }}
            >
              <div className="text-xs font-medium text-primary mb-0.5">{message.replyToMessage.senderName}</div>
              <div className="text-xs opacity-70 truncate max-w-[200px]">
                {message.replyToMessage.type === 'image' ? '📷 Photo' : 
                 message.replyToMessage.type === 'file' ? '📄 File' : 
                 message.replyToMessage.type === 'audio' ? '🎤 Voice Message' : 
                 message.replyToMessage.content}
              </div>
            </div>
          )}

          {/* Sender Name (Group Chat Style) */}
          {!message.isMe && isFirstInGroup && (
            <span className="text-[13px] font-medium text-[#d85834] px-2 pt-1 pb-0.5 leading-none cursor-pointer hover:underline">
              {message.senderName}
            </span>
          )}

          {/* Message Content */}
          <div className={cn(
            "px-2 py-1.5 text-[14.2px] text-[#111b21] dark:text-[#e9edef] leading-[19px] min-w-[80px]",
            message.type === 'image' && "p-1"
          )}>
            {message.type === 'text' && message.content}

            {message.type === 'image' && (
               <div className="relative group/image mb-1">
                 {displayUrl ? (
                   <img 
                     src={displayUrl}
                     alt={message.content || "Image"} 
                     className="rounded-lg object-cover cursor-pointer max-w-full max-h-[300px]"
                     onClick={() => window.open(displayUrl, '_blank')}
                   />
                 ) : (
                   <div className="flex items-center justify-center h-48 w-64 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400">
                     <FileIcon className="h-10 w-10" />
                   </div>
                 )}
                 {message.content && message.content !== message.fileName && (
                   <p className="mt-1 text-sm">{message.content}</p>
                 )}
               </div>
            )}

            {/* Other types (File/Audio) omitted for brevity, keeping existing structure would be ideal if space permitted */}
            {message.type === 'file' && (
              <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-2 rounded-md mb-1">
                <div className="bg-[#f06d6d] text-white p-2 rounded-lg">
                  <FileIcon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                   <p className="truncate font-medium">{message.fileName}</p>
                   <p className="text-xs opacity-60">{message.fileSize ? `${(message.fileSize/1024).toFixed(0)} KB` : 'File'} • {message.mimeType?.split('/')[1]?.toUpperCase()}</p>
                </div>
                {displayUrl && (
                  <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="p-2" download={message.fileName}>
                    <Download className="h-5 w-5 opacity-50" />
                  </a>
                )}
              </div>
            )}
            
            {message.type === 'audio' && (
              <div className="flex items-center gap-2 min-w-[240px] py-1">
                 <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700" onClick={() => {
                    const audio = new Audio(displayUrl || "");
                    audio.play();
                 }}>
                    <Play className="h-5 w-5 ml-1 fill-current" />
                 </Button>
                 <div className="flex-1 flex flex-col justify-center">
                    <div className="h-1 bg-slate-300 dark:bg-slate-600 rounded-full w-full mb-1">
                       <div className="h-full bg-slate-500 w-0" />
                    </div>
                    <span className="text-[11px] text-slate-500">0:00</span>
                 </div>
                 <Avatar className="h-8 w-8">
                   <AvatarImage src={message.senderAvatar} />
                   <AvatarFallback>U</AvatarFallback>
                 </Avatar>
              </div>
            )}

            {/* Metadata (Time + Receipt) - Floating bottom right */}
            <div className="flex items-center justify-end gap-1 select-none float-right mt-1 ml-2 relative top-[2px]">
              <span className="text-[11px] text-[#667781] dark:text-[#8696a0]">
                {format(message.createdAt, 'h:mm a')}
              </span>
              {message.isMe && (
                message.status === "sending" ? (
                  <span className="ml-0.5 text-[#8696a0] animate-pulse">
                    <Clock3 className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <span className={cn(
                    "ml-0.5",
                    message.isRead ? "text-[#53bdeb]" : "text-[#8696a0]"
                  )}>
                    <CheckCheck className="h-3.5 w-3.5" />
                  </span>
                )
              )}
            </div>
          </div>

          {/* Reactions Display (WhatsApp Style) */}
          {message.reactions && message.reactions.length > 0 && (
            <div className={cn(
              "absolute -bottom-3 z-10 flex items-center gap-0.5 bg-white dark:bg-[#202c33] rounded-full px-1 py-0.5 shadow-sm border border-slate-100 dark:border-[#202c33]",
              message.isMe ? "right-2" : "left-2"
            )} onClick={() => setShowReactionPicker(true)}>
              {message.reactions.slice(0, 3).map((r, i) => (
                <span key={i} className="text-[10px] leading-none">{r.emoji}</span>
              ))}
              {message.reactions.length > 1 && (
                <span className="text-[10px] text-slate-500 ml-0.5">{message.reactions.reduce((a,b) => a + b.count, 0)}</span>
              )}
            </div>
          )}
        </div>

        {/* Hover Actions (Desktop) */}
        <div className={cn(
          "opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 flex items-center",
          message.isMe ? "-left-8" : "-right-8"
        )}>
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                <span className="sr-only">Menu</span>
                <svg viewBox="0 0 24 24" width="24" height="24" className="fill-slate-400">
                  <path fill="currentColor" d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z"></path>
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={message.isMe ? "end" : "start"}>
              <DropdownMenuItem disabled={!canInteract} onClick={() => onReply?.(message._id)}>Reply</DropdownMenuItem>
              <DropdownMenuItem disabled={!canInteract} onClick={() => setShowReactionPicker(true)}>React</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(message.content)}>Copy</DropdownMenuItem>
              {message.isMe && (
                <>
                  <DropdownMenuSeparator />
                  {message.type === 'text' && (
                    <DropdownMenuItem onClick={handleEditClick}>Edit</DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onDelete?.(message._id)} className="text-red-500">Delete</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
