import React from 'react';
import { Lock, Users } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/app/AppUI";
import { WhatsAppCallControls } from './WhatsAppCallControls';

interface ActiveCallScreenProps {
  remoteName: string;
  remoteAvatar?: string;
  callStatus: 'ringing' | 'connected' | 'reconnecting';
  callDuration?: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isSpeakerEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleSpeaker: () => void;
  onEndCall: () => void;
  children?: React.ReactNode;
  localVideo?: React.ReactNode;
}

export function ActiveCallScreen({
  remoteName,
  remoteAvatar,
  callStatus,
  callDuration = "00:00",
  isAudioEnabled,
  isVideoEnabled,
  isSpeakerEnabled,
  onToggleAudio,
  onToggleVideo,
  onToggleSpeaker,
  onEndCall,
  children,
  localVideo,
}: ActiveCallScreenProps) {
  const statusLabel = callStatus === 'ringing' ? 'Ringing' : callStatus === 'reconnecting' ? 'Reconnecting' : callDuration;

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-[#09090b] text-[#fafafa] [font-family:Space_Grotesk,_Inter,_sans-serif]">
      <div aria-hidden="true" className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: "linear-gradient(rgba(63,63,70,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(63,63,70,0.28) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />

      <div className="relative z-10 px-4 pt-5 sm:px-6 sm:pt-7">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between border-2 border-[#3f3f46] bg-[#09090b] px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#dfe104]">Active call</p>
            <h1 className="truncate text-xl font-bold uppercase tracking-[-0.04em] sm:text-2xl">{remoteName}</h1>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a1a1aa]">{statusLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 border border-[#3f3f46] bg-[#18181b] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#dfe104]">
              <Lock className="h-3 w-3" />
              Encrypted
            </span>
            <span className="inline-flex items-center gap-1 border border-[#3f3f46] bg-[#18181b] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a1a1aa]">
              <Users className="h-3 w-3" />
              2
            </span>
          </div>
        </div>
      </div>

      {isVideoEnabled && localVideo ? (
        <div className="absolute right-4 top-28 z-30 h-48 w-32 overflow-hidden border-2 border-[#3f3f46] bg-[#111217]">
          {localVideo}
        </div>
      ) : null}

      <div className="relative z-10 flex flex-1 items-center justify-center px-4">
        {children ? (
          <div className="relative h-full max-h-[80vh] w-full overflow-hidden border-2 border-[#3f3f46] bg-[#111217]">
            {children}
          </div>
        ) : (
          <div className="relative border-2 border-[#3f3f46] bg-[#111217] p-10">
            <Avatar className="h-40 w-40 rounded-none border-2 border-[#3f3f46] bg-[#18181b] md:h-56 md:w-56">
              <AvatarImage src={remoteAvatar} className="object-cover" />
              <AvatarFallback className="rounded-none bg-[#18181b] text-5xl font-bold uppercase tracking-[0.08em] text-[#dfe104]">
                {remoteName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>

      <div className="relative z-20 w-full">
        <WhatsAppCallControls
          isAudioEnabled={isAudioEnabled}
          isVideoEnabled={isVideoEnabled}
          isSpeakerEnabled={isSpeakerEnabled}
          onToggleAudio={onToggleAudio}
          onToggleVideo={onToggleVideo}
          onToggleSpeaker={onToggleSpeaker}
          onEndCall={onEndCall}
        />
      </div>
    </div>
  );
}

