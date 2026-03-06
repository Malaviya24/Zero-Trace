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
    <div className="w-full bg-[#1f2c34] rounded-t-[2rem] pb-8 pt-4 px-6 flex flex-col items-center shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
      {/* Handle bar for bottom sheet feel */}
      <div className="w-10 h-1 bg-gray-600 rounded-full mb-6 opacity-50" />
      
      <div className="flex items-center justify-between w-full max-w-sm px-2">
        <ControlBtn 
          icon={isSpeakerEnabled ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />} 
          isActive={isSpeakerEnabled}
          onClick={onToggleSpeaker}
        />
        
        <ControlBtn 
          icon={isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />} 
          isActive={!isVideoEnabled} // Active state usually means "On" but here we might want "Off" to look distinct? WhatsApp logic: White is on, Crossed is off.
          onClick={onToggleVideo}
        />
        
        <ControlBtn 
          icon={isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />} 
          isActive={!isAudioEnabled} 
          onClick={onToggleAudio}
        />
        
        <div className="bg-red-500 rounded-full p-4 cursor-pointer hover:bg-red-600 transition-colors shadow-lg" onClick={onEndCall}>
          <PhoneOff className="h-7 w-7 text-white fill-white" />
        </div>
      </div>

      {/* Secondary Actions (Swipe up or Tap) */}
      <div className="mt-6 flex gap-8">
         <button className="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <div className="p-3 rounded-full bg-gray-800">
              <Users className="h-5 w-5" />
            </div>
            <span className="text-xs">Add</span>
         </button>
         <button className="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <div className="p-3 rounded-full bg-gray-800">
              <MoreVertical className="h-5 w-5" />
            </div>
            <span className="text-xs">More</span>
         </button>
      </div>
    </div>
  );
}

function ControlBtn({ icon, isActive, onClick }: { icon: React.ReactNode, isActive?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-3 rounded-full transition-all duration-200",
        isActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
      )}
    >
      {icon}
    </button>
  );
}
