import React from 'react';
import { cn } from "@/lib/utils";
import {
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  Volume2, 
  VolumeX, 
  Users,
  MoreVertical
} from 'lucide-react';

interface CallControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isSpeakerEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleSpeaker: () => void;
  onEndCall: () => void;
}

export function WhatsAppCallControls({
  isAudioEnabled,
  isVideoEnabled,
  isSpeakerEnabled,
  onToggleAudio,
  onToggleVideo,
  onToggleSpeaker,
  onEndCall
}: CallControlsProps) {
  return (
    <div className="w-full px-4 pb-6 sm:px-6">
      <div className="mx-auto w-full max-w-xl rounded-[28px] border border-white/10 bg-black/55 px-4 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="mb-3 flex justify-center">
          <div className="h-1.5 w-12 rounded-full bg-white/25" />
        </div>

        <div className="flex items-center justify-center gap-3">
        <ControlBtn 
          icon={isSpeakerEnabled ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />} 
          isActive={isSpeakerEnabled}
          onClick={onToggleSpeaker}
            label="Speaker"
        />
        
        <ControlBtn 
          icon={isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />} 
          isActive={isVideoEnabled}
          onClick={onToggleVideo}
            label="Video"
        />
        
        <ControlBtn 
          icon={isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />} 
          isActive={isAudioEnabled} 
          onClick={onToggleAudio}
            label="Mic"
        />
        
          <button
            onClick={onEndCall}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-[0_10px_24px_rgba(239,68,68,0.45)] transition-colors hover:bg-red-400"
            aria-label="End call"
          >
            <PhoneOff className="h-7 w-7" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-4 text-white/80">
          <button className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs hover:bg-white/10">
            <Users className="h-4 w-4" />
            Participants
          </button>
          <button className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs hover:bg-white/10">
            <MoreVertical className="h-4 w-4" />
            More
          </button>
        </div>
      </div>
    </div>
  );
}

function ControlBtn({
  icon,
  isActive,
  onClick,
  label,
}: {
  icon: React.ReactNode;
  isActive?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button 
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200",
        isActive ? "bg-white/25 text-white hover:bg-white/35" : "bg-white/10 text-white/70 hover:bg-white/20"
      )}
    >
      {icon}
    </button>
  );
}
