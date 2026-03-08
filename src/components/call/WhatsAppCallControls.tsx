import { Button } from "@/components/ui/button";
import {
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
  Bluetooth,
} from "lucide-react";
import { motion } from "framer-motion";
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
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="w-full max-w-3xl px-3 sm:px-5 pb-4 sm:pb-6"
    >
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white/90 tabular-nums ring-1 ring-white/15">
          {callDurationLabel || "00:00"}
        </span>
        <span className={`rounded-full bg-black/40 px-3 py-1 text-xs font-medium uppercase tracking-wide ring-1 ring-white/15 ${qualityTone}`}>
          {connectionQuality || "unknown"}
        </span>
        <span className="rounded-full bg-black/40 px-3 py-1 text-xs text-white/90 ring-1 ring-white/15">
          {getParticipantLabel(participantsCount)}
        </span>
        {isBluetooth && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2.5 py-1 text-[10px] font-medium text-sky-200 ring-1 ring-sky-300/20" title="Audio through Bluetooth">
            <Bluetooth className="h-3 w-3" />
            Bluetooth
          </span>
        )}
      </div>

      <div className="rounded-[28px] bg-black/55 px-3 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10 backdrop-blur-2xl">
        <div className="mb-3 flex items-center justify-center gap-2 sm:gap-3">
          {onToggleSpeaker && (
            <Button
              onClick={onToggleSpeaker}
              size="icon"
              className={`h-12 w-12 rounded-full ${isSpeakerEnabled ? "bg-white/25 hover:bg-white/35 text-white" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
              aria-label={speakerLabel}
              title={speakerLabel}
            >
              {isSpeakerEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>
          )}
          {onToggleVideo && (
            <Button
              onClick={onToggleVideo}
              size="icon"
              className={`h-12 w-12 rounded-full ${isVideoEnabled ? "bg-emerald-500 hover:bg-emerald-400 text-black" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
              aria-label={videoLabel}
              title={videoLabel}
            >
              {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
          )}
        <Button
          onClick={onToggleAudio}
          size="icon"
              className={`h-14 w-14 rounded-full ${isAudioEnabled ? "bg-white/25 hover:bg-white/35 text-white" : "bg-amber-500 hover:bg-amber-400 text-black"}`}
              aria-label={micLabel}
              title={micLabel}
        >
          {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>

        {onToggleHold && (
            <Button
              onClick={onToggleHold}
              size="icon"
              className={`h-12 w-12 rounded-full ${isOnHold ? "bg-indigo-500 hover:bg-indigo-400 text-white" : "bg-white/25 hover:bg-white/35 text-white"}`}
              aria-label={holdLabel}
              title={holdLabel}
            >
            <Pause className="h-5 w-5" />
          </Button>
        )}
          <Button
            onClick={onEndCall}
            size="icon"
            className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-400 text-white shadow-[0_10px_24px_rgba(239,68,68,0.45)]"
            aria-label="End call"
            title="End call"
          >
            <PhoneOff className="h-6 w-6" />
        </Button>
          {onTransferCall && (
            <Button onClick={onTransferCall} size="icon" className="h-12 w-12 rounded-full bg-white/25 hover:bg-white/35 text-white" aria-label="Share call" title="Share call link">
              <Forward className="h-5 w-5" />
            </Button>
          )}
        </div>

        <div className="flex items-center justify-center gap-4">
          {onToggleParticipants && (
            <Button onClick={onToggleParticipants} size="sm" variant="ghost" className="h-9 rounded-full px-3 text-white/85 hover:bg-white/15" aria-label="Participants">
              <Users className="h-4 w-4 mr-2" />
              People
            </Button>
          )}
          {onToggleChat && (
            <Button onClick={onToggleChat} size="sm" variant="ghost" className="h-9 rounded-full px-3 text-white/85 hover:bg-white/15" aria-label="Chat">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </Button>
          )}
          {onOpenSettings && (
            <Button onClick={onOpenSettings} size="sm" variant="ghost" className="h-9 rounded-full px-3 text-white/85 hover:bg-white/15" aria-label="Settings">
              <Settings className="h-4 w-4 mr-2" />
              Audio
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
