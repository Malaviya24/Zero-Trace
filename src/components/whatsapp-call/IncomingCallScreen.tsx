import React from 'react';
import { Lock, MessageSquare, Phone, PhoneOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSwipeable } from 'react-swipeable';

interface IncomingCallScreenProps {
  callerName: string;
  callerAvatar?: string;
  callType?: 'voice' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallScreen({ 
  callerName, 
  callerAvatar, 
  callType = 'voice', 
  onAccept, 
  onReject 
}: IncomingCallScreenProps) {
  const handlers = useSwipeable({
    onSwipedUp: () => onAccept(),
    trackMouse: true
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden bg-[#0b141a] p-6 text-white sm:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,211,102,0.18),transparent_55%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(11,20,26,0.96),rgba(9,32,37,0.9),rgba(11,20,26,0.98))]" />

      {callerAvatar && (
        <div 
          className="absolute inset-0 z-0 scale-110 bg-cover bg-center opacity-20 blur-3xl"
          style={{ backgroundImage: `url(${callerAvatar})` }}
        />
      )}

      <div className="z-10 mt-8 flex w-full max-w-sm flex-col items-center space-y-4">
        <div className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-500/15 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-100">
          <Lock className="h-3 w-3" />
          Encrypted {callType === "video" ? "video" : "voice"} call
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">{callerName}</h1>
          <p className="mt-1 text-sm text-white/70">Incoming call...</p>
        </div>
      </div>

      <div className="z-10 flex-1 flex items-center justify-center">
        <div className="relative">
          <Avatar className="h-32 w-32 md:h-40 md:w-40 ring-2 ring-white/10 shadow-2xl">
            <AvatarImage src={callerAvatar} className="object-cover" />
            <AvatarFallback className="bg-[#128C7E] text-4xl font-bold">
              {callerName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 rounded-full border border-[#25D366]/30 animate-ping duration-1000" />
          <div className="absolute inset-0 rounded-full border border-[#25D366]/20 animate-ping delay-150 duration-1000" />
        </div>
      </div>

      <div className="z-10 mb-6 w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-2 opacity-85 animate-bounce">
          <div className="h-1 w-10 rounded-full bg-white/40" />
          <span className="text-xs font-medium tracking-wide">Swipe up or tap green to accept</span>
        </div>

        <div className="flex items-center justify-between px-4" {...handlers}>
          <div className="flex flex-col items-center gap-2">
            <button className="rounded-full bg-white/10 p-3 backdrop-blur-sm transition-colors hover:bg-white/20">
              <MessageSquare className="h-6 w-6 text-white" />
            </button>
            <span className="text-xs text-white/70">Message</span>
          </div>

          <div className="relative" onClick={onAccept}>
            <div className="absolute -inset-4 animate-pulse rounded-full bg-[#25D366]/20" />
            <div className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-[#25D366] shadow-lg transition-transform hover:scale-110">
              <Phone className="h-8 w-8 fill-white text-white" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onReject}
              className="rounded-full bg-red-500/20 p-3 backdrop-blur-sm transition-colors hover:bg-red-500/30"
            >
              <PhoneOff className="h-6 w-6 text-red-400" />
            </button>
            <span className="text-xs text-white/70">Decline</span>
          </div>
        </div>
      </div>
    </div>
  );
}
