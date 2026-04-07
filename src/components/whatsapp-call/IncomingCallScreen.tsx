import React from 'react';
import { Lock, MessageSquare, Phone, PhoneOff } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/app/AppUI";

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
  onReject,
}: IncomingCallScreenProps) {
  const handlers = useSwipeable({ onSwipedUp: () => onAccept(), trackMouse: true });

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden bg-[#09090b] p-6 text-[#fafafa] [font-family:Space_Grotesk,_Inter,_sans-serif] sm:p-8">
      <div aria-hidden="true" className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: "linear-gradient(rgba(63,63,70,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(63,63,70,0.28) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
      {callerAvatar ? <div className="absolute inset-0 z-0 scale-110 bg-cover bg-center opacity-10 blur-3xl" style={{ backgroundImage: `url(${callerAvatar})` }} /> : null}

      <div className="z-10 mt-8 flex w-full max-w-md flex-col items-center space-y-4 border-2 border-[#3f3f46] bg-[#09090b] px-6 py-5">
        <div className="inline-flex items-center gap-1 border border-[#3f3f46] bg-[#18181b] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#dfe104]">
          <Lock className="h-3 w-3" />
          Encrypted {callType === "video" ? "video" : "voice"} call
        </div>
        <div className="text-center">
          <h1 className="text-[clamp(2rem,7vw,4.5rem)] font-bold uppercase leading-[0.84] tracking-[-0.06em]">{callerName}</h1>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[#a1a1aa]">Incoming call</p>
        </div>
      </div>

      <div className="z-10 flex flex-1 items-center justify-center">
        <div className="relative border-2 border-[#3f3f46] bg-[#111217] p-8">
          <Avatar className="h-32 w-32 rounded-none border-2 border-[#3f3f46] bg-[#18181b] md:h-40 md:w-40">
            <AvatarImage src={callerAvatar} className="object-cover" />
            <AvatarFallback className="rounded-none bg-[#18181b] text-4xl font-bold uppercase tracking-[0.08em] text-[#dfe104]">
              {callerName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      <div className="z-10 mb-6 w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 opacity-85">
          <div className="h-1 w-12 bg-[#dfe104]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#a1a1aa]">Swipe up or tap answer</span>
        </div>

        <div className="flex items-center justify-between px-4" {...handlers}>
          <div className="flex flex-col items-center gap-2">
            <button type="button" className="flex h-14 w-14 items-center justify-center border-2 border-[#3f3f46] bg-[#18181b] text-[#fafafa] transition-colors hover:bg-[#232327]">
              <MessageSquare className="h-5 w-5" />
            </button>
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#a1a1aa]">Message</span>
          </div>

          <div className="relative" onClick={onAccept}>
            <div className="absolute -inset-4 animate-pulse border border-[#dfe104]/40" />
            <div className="flex h-16 w-16 cursor-pointer items-center justify-center border-2 border-[#dfe104] bg-[#dfe104] text-black transition-transform hover:scale-105">
              <Phone className="h-7 w-7 fill-current" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onReject}
              className="flex h-14 w-14 items-center justify-center border-2 border-red-500 bg-red-500/15 text-red-400 transition-colors hover:bg-red-500/25"
            >
              <PhoneOff className="h-5 w-5" />
            </button>
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#a1a1aa]">Decline</span>
          </div>
        </div>
      </div>
    </div>
  );
}

