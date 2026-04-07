import { motion } from "framer-motion";
import {
  Bluetooth,
  Forward,
  MessageSquare,
  Mic,
  MicOff,
  Pause,
  PhoneOff,
  Settings,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Button } from "@/components/app/AppUI";
import { getParticipantLabel, getQualityToneClass } from "@/lib/call-ui-utils";

interface WhatsAppCallControlsProps {
  isAudioEnabled: boolean;
  isSpeakerEnabled?: boolean;
  isVideoEnabled?: boolean;
  isOnHold?: boolean;
  isBluetooth?: boolean;
  participantsCount?: number;
  callDurationLabel?: string;
  connectionQuality?: "excellent" | "good" | "fair" | "poor" | null;
  onToggleAudio: () => void;
  onToggleSpeaker?: () => void;
  onToggleVideo?: () => void;
  onToggleParticipants?: () => void;
  onToggleChat?: () => void;
  onOpenSettings?: () => void;
  onToggleHold?: () => void;
  onTransferCall?: () => void;
  onEndCall: () => void;
}

export function WhatsAppCallControls({
  isAudioEnabled,
  isSpeakerEnabled = true,
  isVideoEnabled = false,
  isOnHold = false,
  isBluetooth = false,
  participantsCount = 1,
  callDurationLabel,
  connectionQuality = "good",
  onToggleAudio,
  onToggleSpeaker,
  onToggleVideo,
  onToggleParticipants,
  onToggleChat,
  onOpenSettings,
  onToggleHold,
  onTransferCall,
  onEndCall,
}: WhatsAppCallControlsProps) {
  const qualityTone = getQualityToneClass(connectionQuality);
  const micLabel = isAudioEnabled ? "Mute" : "Unmute";
  const speakerLabel = isSpeakerEnabled ? "Speaker on" : "Speaker off";
  const videoLabel = isVideoEnabled ? "Camera on" : "Camera off";
  const holdLabel = isOnHold ? "Resume" : "Hold";

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="w-full max-w-4xl px-3 pb-4 sm:px-5 sm:pb-6"
    >
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        <span className="border border-[#3f3f46] bg-[#09090b] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#fafafa]">
          {callDurationLabel || "00:00"}
        </span>
        <span className={`border border-[#3f3f46] bg-[#09090b] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] ${qualityTone}`}>
          {connectionQuality || "unknown"}
        </span>
        <span className="border border-[#3f3f46] bg-[#09090b] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#a1a1aa]">
          {getParticipantLabel(participantsCount)}
        </span>
        {isBluetooth ? (
          <span className="inline-flex items-center gap-1 border border-[#3f3f46] bg-[#09090b] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#dfe104]">
            <Bluetooth className="h-3 w-3" />
            Bluetooth
          </span>
        ) : null}
      </div>

      <div className="border-2 border-[#3f3f46] bg-[#09090b] p-3 sm:p-4">
        <div className="mb-4 flex items-center justify-center gap-2 sm:gap-3">
          {onToggleSpeaker ? (
            <Button
              onClick={onToggleSpeaker}
              size="icon"
              className={`h-12 w-12 rounded-none border-2 ${isSpeakerEnabled ? "border-[#dfe104] bg-[#dfe104] text-black hover:bg-[#d3d53c]" : "border-[#3f3f46] bg-[#18181b] text-[#fafafa] hover:bg-[#232327]"}`}
              aria-label={speakerLabel}
              title={speakerLabel}
            >
              {isSpeakerEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>
          ) : null}
          {onToggleVideo ? (
            <Button
              onClick={onToggleVideo}
              size="icon"
              className={`h-12 w-12 rounded-none border-2 ${isVideoEnabled ? "border-[#dfe104] bg-[#dfe104] text-black hover:bg-[#d3d53c]" : "border-[#3f3f46] bg-[#18181b] text-[#fafafa] hover:bg-[#232327]"}`}
              aria-label={videoLabel}
              title={videoLabel}
            >
              {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
          ) : null}
          <Button
            onClick={onToggleAudio}
            size="icon"
            className={`h-14 w-14 rounded-none border-2 ${isAudioEnabled ? "border-[#3f3f46] bg-[#18181b] text-[#fafafa] hover:bg-[#232327]" : "border-[#dfe104] bg-[#dfe104] text-black hover:bg-[#d3d53c]"}`}
            aria-label={micLabel}
            title={micLabel}
          >
            {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
          {onToggleHold ? (
            <Button
              onClick={onToggleHold}
              size="icon"
              className={`h-12 w-12 rounded-none border-2 ${isOnHold ? "border-[#dfe104] bg-[#dfe104] text-black hover:bg-[#d3d53c]" : "border-[#3f3f46] bg-[#18181b] text-[#fafafa] hover:bg-[#232327]"}`}
              aria-label={holdLabel}
              title={holdLabel}
            >
              <Pause className="h-5 w-5" />
            </Button>
          ) : null}
          <Button
            onClick={onEndCall}
            size="icon"
            className="h-16 w-16 rounded-none border-2 border-red-500 bg-red-500 text-white hover:bg-red-400"
            aria-label="End call"
            title="End call"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
          {onTransferCall ? (
            <Button
              onClick={onTransferCall}
              size="icon"
              className="h-12 w-12 rounded-none border-2 border-[#3f3f46] bg-[#18181b] text-[#fafafa] hover:bg-[#232327]"
              aria-label="Share call"
              title="Share call link"
            >
              <Forward className="h-5 w-5" />
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {onToggleParticipants ? (
            <Button onClick={onToggleParticipants} size="sm" className="h-10 rounded-none border border-[#3f3f46] bg-[#18181b] px-4 text-xs font-bold uppercase tracking-[0.16em] text-[#fafafa] hover:bg-[#232327]">
              <Users className="mr-2 h-4 w-4" />
              People
            </Button>
          ) : null}
          {onToggleChat ? (
            <Button onClick={onToggleChat} size="sm" className="h-10 rounded-none border border-[#3f3f46] bg-[#18181b] px-4 text-xs font-bold uppercase tracking-[0.16em] text-[#fafafa] hover:bg-[#232327]">
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat
            </Button>
          ) : null}
          {onOpenSettings ? (
            <Button onClick={onOpenSettings} size="sm" className="h-10 rounded-none border border-[#3f3f46] bg-[#18181b] px-4 text-xs font-bold uppercase tracking-[0.16em] text-[#fafafa] hover:bg-[#232327]">
              <Settings className="mr-2 h-4 w-4" />
              Audio
            </Button>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

