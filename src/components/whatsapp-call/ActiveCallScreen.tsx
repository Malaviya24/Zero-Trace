import React from 'react';
import { Lock, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  children?: React.ReactNode; // For video tiles
  localVideo?: React.ReactNode; // For PiP
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
  localVideo
}: ActiveCallScreenProps) {
  const statusLabel =
    callStatus === "ringing"
      ? "Ringing..."
      : callStatus === "reconnecting"
      ? "Reconnecting..."
      : callDuration;

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-[#0b141a] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,211,102,0.16),transparent_55%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(11,20,26,0.96),rgba(9,32,37,0.9),rgba(11,20,26,0.98))]" />

      <div className="relative z-10 px-4 pt-5 sm:px-6 sm:pt-7">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between rounded-2xl border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-xl">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold sm:text-lg">{remoteName}</h1>
            <p className="text-xs text-white/70">{statusLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-500/15 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-emerald-100">
              <Lock className="h-3 w-3" />
              Encrypted
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] text-white/85">
              <Users className="h-3 w-3" />
              2
            </span>
          </div>
        </div>
      </div>

      {isVideoEnabled && localVideo && (
        <div className="absolute right-4 top-24 z-30 h-48 w-32 overflow-hidden rounded-lg border border-white/10 bg-black shadow-xl">
          {localVideo}
        </div>
      )}

      <div className="relative z-10 flex flex-1 items-center justify-center px-4">
        {children ? (
          <div className="relative h-full max-h-[80vh] w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
            {children}
          </div>
        ) : (
          <div className="relative">
            <Avatar className="h-40 w-40 shadow-2xl ring-4 ring-[#1f2c34] md:h-56 md:w-56">
              <AvatarImage src={remoteAvatar} className="object-cover" />
              <AvatarFallback className="bg-[#128C7E] text-5xl font-bold">
                {remoteName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {callStatus === "ringing" && (
              <div className="absolute inset-0 animate-ping rounded-full border-2 border-[#25D366]/30 duration-[2s]" />
            )}
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
