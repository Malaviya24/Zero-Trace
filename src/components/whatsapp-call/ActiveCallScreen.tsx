import React from 'react';
import { Lock } from 'lucide-react';
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
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#0b141a] text-white overflow-hidden">
      
      {/* Header */}
      <div className="flex flex-col items-center pt-8 pb-4 z-10">
        <div className="flex items-center gap-1.5 text-gray-400 text-[10px] uppercase tracking-widest font-medium mb-2">
          <Lock className="h-3 w-3" />
          End-to-end encrypted
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{remoteName}</h1>
        <p className="text-sm text-gray-400 font-medium mt-1">
          {callStatus === 'ringing' ? 'Ringing...' : callDuration}
        </p>
      </div>

      {/* Local Video Preview (Picture-in-Picture) */}
      {isVideoEnabled && localVideo && (
        <div className="absolute top-20 right-4 w-32 h-48 bg-black rounded-lg shadow-xl overflow-hidden border border-white/10 z-30">
          {localVideo}
        </div>
      )}

      {/* Main Content Area (Avatar or Video) */}
      <div className="flex-1 relative flex items-center justify-center w-full px-4">
        {/* If video enabled (children present), show video. Else show avatar. */}
        {children ? (
          <div className="w-full h-full max-h-[80vh] rounded-2xl overflow-hidden shadow-2xl bg-black relative">
            {children}
          </div>
        ) : (
          <div className="relative">
             {/* Large Avatar */}
             <Avatar className="h-40 w-40 md:h-56 md:w-56 ring-4 ring-[#1f2c34] shadow-2xl">
               <AvatarImage src={remoteAvatar} className="object-cover" />
               <AvatarFallback className="bg-[#128C7E] text-5xl font-bold">
                 {remoteName.slice(0, 2).toUpperCase()}
               </AvatarFallback>
             </Avatar>
             
             {/* Pulse ring for active speaker? Optional */}
             {callStatus === 'ringing' && (
               <div className="absolute inset-0 rounded-full border-2 border-[#25D366]/30 animate-ping duration-[2s]" />
             )}
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="w-full z-20">
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
