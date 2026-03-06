import React from 'react';
import { Phone, PhoneOff, MessageSquare } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#0b141a] text-white p-8 overflow-hidden font-sans">
      {/* Background Blur Effect */}
      {callerAvatar && (
        <div 
          className="absolute inset-0 opacity-30 blur-3xl scale-110 z-0 bg-center bg-cover"
          style={{ backgroundImage: `url(${callerAvatar})` }}
        />
      )}

      {/* Header Info */}
      <div className="z-10 flex flex-col items-center mt-12 space-y-4">
        <div className="flex flex-col items-center space-y-1">
          <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse"/> 
              WhatsApp {callType === 'video' ? 'Video' : 'Voice'} Call
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{callerName}</h1>
        </div>
      </div>

      {/* Avatar */}
      <div className="z-10 flex-1 flex items-center justify-center">
        <div className="relative">
          <Avatar className="h-32 w-32 md:h-40 md:w-40 ring-2 ring-white/10 shadow-2xl">
            <AvatarImage src={callerAvatar} className="object-cover" />
            <AvatarFallback className="bg-[#128C7E] text-4xl font-bold">
              {callerName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {/* Ripple Effect */}
          <div className="absolute inset-0 rounded-full border border-[#25D366]/30 animate-ping duration-1000" />
          <div className="absolute inset-0 rounded-full border border-[#25D366]/20 animate-ping delay-150 duration-1000" />
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="z-10 w-full max-w-sm flex flex-col items-center space-y-8 mb-8">
        
        {/* Swipe Hint */}
        <div className="flex flex-col items-center space-y-2 opacity-80 animate-bounce">
          <div className="w-1 h-1 rounded-full bg-white/50" />
          <div className="w-1 h-1 rounded-full bg-white/70" />
          <div className="w-1 h-1 rounded-full bg-white" />
          <span className="text-xs font-medium tracking-wide">Swipe up to accept</span>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between w-full px-4" {...handlers}>
          
          {/* Message / Decline */}
          <div className="flex flex-col items-center gap-2">
             <button className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm">
               <MessageSquare className="h-6 w-6 text-white" />
             </button>
             <span className="text-xs text-white/70">Message</span>
          </div>

          {/* Swipe Trigger Area (Accept) */}
          <div className="relative" onClick={onAccept}>
             <div className="absolute -inset-4 rounded-full bg-[#25D366]/20 animate-pulse" />
             <div className="h-16 w-16 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg cursor-pointer transform hover:scale-110 transition-transform">
               <Phone className="h-8 w-8 text-white fill-white" />
             </div>
          </div>

          {/* Reject */}
          <div className="flex flex-col items-center gap-2">
             <button 
               onClick={onReject}
               className="p-3 rounded-full bg-red-500/20 hover:bg-red-500/30 transition-colors backdrop-blur-sm"
             >
               <PhoneOff className="h-6 w-6 text-red-500" />
             </button>
             <span className="text-xs text-white/70">Decline</span>
          </div>

        </div>
      </div>
    </div>
  );
}
