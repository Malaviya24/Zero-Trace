import React, { useState, useRef } from 'react';
import { cn } from "@/lib/utils";
import { Send, Paperclip, Smile, Mic, Image as ImageIcon, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

export interface CometChatMessageComposerProps {
  onSend: (content: string, type: 'text' | 'image' | 'file' | 'audio', file?: File) => Promise<void> | void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  replyTo?: { senderName: string; content: string; type: 'text' | 'image' | 'file' | 'audio' | 'system' } | null;
  onCancelReply?: () => void;
}

export function CometChatMessageComposer({
  onSend,
  onTyping,
  disabled,
  replyTo,
  onCancelReply
}: CometChatMessageComposerProps) {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isSending) return;
    if (e.key === 'Enter' && !e.shiftKey) {
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
    if (!message.trim() || isSending) return;
    setIsSending(true);
    try {
      await onSend(message, 'text');
      setMessage('');
      setIsTyping(false);
      onTyping?.(false);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSending) return;
    const file = e.target.files?.[0];
    if (!file) return;
    
    const type = file.type.startsWith('image/') ? 'image' : 'file';
    setIsSending(true);
    try {
      await onSend(file.name, type, file);
    } finally {
      setIsSending(false);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const handleMicClick = async () => {
    if (isSending) return;
    if (isRecording) {
      // Stop recording
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
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
        void onSend("Voice Message", 'audio', file);
        stream.getTracks().forEach(track => track.stop());
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

  return (
    <div className="bg-[#f0f2f5] dark:bg-[#202c33] p-2 flex items-end gap-2 border-t border-slate-200 dark:border-slate-800 relative z-20">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileUpload}
      />
      {/* Reply Preview */}
      {replyTo && (
        <div className="absolute bottom-full left-0 right-0 bg-slate-100 dark:bg-slate-800 p-2 border-l-4 border-primary shadow-md flex items-center justify-between z-10 animate-in slide-in-from-bottom-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-primary mb-0.5">{replyTo.senderName}</p>
            <p className="text-xs text-muted-foreground truncate">
              {replyTo.type === 'image' ? '📷 Photo' : 
               replyTo.type === 'file' ? '📄 File' : 
               replyTo.type === 'audio' ? '🎤 Voice Message' : 
               replyTo.content}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancelReply}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-2xl flex items-end shadow-sm border border-slate-200/50 dark:border-slate-700/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all duration-200">
        {/* Attachments */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
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
                <ImageIcon className="h-4 w-4" /> Image
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

        {/* Input */}
        <div className="flex-1 min-h-[40px] py-2">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="min-h-[24px] max-h-[120px] w-full resize-none border-none bg-transparent p-0 focus-visible:ring-0 placeholder:text-slate-400"
            rows={1}
            disabled={disabled || isSending}
          />
        </div>

        {/* Actions */}
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
            disabled={disabled || isSending}
            size="icon"
            className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all duration-200 hover:scale-105"
          >
            <Send className="h-4 w-4 ml-0.5" />
          </Button>
        ) : (
          <Button 
            disabled={disabled || isSending}
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
  );
}
