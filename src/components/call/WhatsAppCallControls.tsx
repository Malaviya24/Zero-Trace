import { Button } from "@/components/ui/button";
import {
  Forward,
  MessageSquare,
  Mic,
  MicOff,
  Pause,
  Phone,
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="w-full max-w-2xl px-3 sm:px-4 pb-6 sm:pb-8"
    >
      {/* Top row: timer, quality, participants + Bluetooth (WhatsApp/Discord style) */}
      <div className="mb-3 flex items-center justify-center gap-2 flex-wrap">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 tabular-nums">
          {callDurationLabel || "00:00"}
        </span>
        <span className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide ${qualityTone}`}>
          {connectionQuality || "unknown"}
        </span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/90">
          {getParticipantLabel(participantsCount)}
        </span>
        {isBluetooth && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2.5 py-1 text-[10px] font-medium text-sky-300" title="Audio through Bluetooth">
            <Bluetooth className="h-3 w-3" />
            Bluetooth
          </span>
        )}
      </div>

      {/* Single compact control bar (WhatsApp/Discord style) */}
      <div className="flex items-center justify-center gap-1 sm:gap-2 rounded-3xl bg-black/40 border border-white/10 px-3 py-3 backdrop-blur-xl">
        {onOpenSettings && (
          <Button onClick={onOpenSettings} size="icon" variant="ghost" className="h-11 w-11 rounded-full text-white hover:bg-white/15" aria-label="Settings">
            <Settings className="h-5 w-5" />
          </Button>
        )}
        {onToggleChat && (
          <Button onClick={onToggleChat} size="icon" variant="ghost" className="h-11 w-11 rounded-full text-white hover:bg-white/15" aria-label="Chat">
            <MessageSquare className="h-5 w-5" />
          </Button>
        )}

        <Button
          onClick={onToggleAudio}
          size="icon"
          className={`h-12 w-12 rounded-full ${isAudioEnabled ? "bg-white/20 hover:bg-white/30 text-white" : "bg-amber-500 hover:bg-amber-400 text-black"}`}
          aria-label={isAudioEnabled ? "Mute" : "Unmute"}
        >
          {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>

        {onToggleVideo && (
          <Button onClick={onToggleVideo} size="icon" className="h-12 w-12 rounded-full bg-white/20 hover:bg-white/30 text-white" aria-label={isVideoEnabled ? "Video off" : "Video on"}>
            {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
        )}

        {onToggleSpeaker && (
          <Button
            onClick={onToggleSpeaker}
            size="icon"
            className={`h-12 w-12 rounded-full ${isSpeakerEnabled ? "bg-white/20 hover:bg-white/30 text-white" : "bg-white/10 text-white/70 hover:bg-white/15"}`}
            aria-label={isSpeakerEnabled ? "Speaker on" : "Speaker off"}
          >
            {isSpeakerEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
        )}

        {onToggleHold && (
          <Button onClick={onToggleHold} size="icon" className={`h-12 w-12 rounded-full ${isOnHold ? "bg-indigo-500 hover:bg-indigo-400 text-white" : "bg-white/20 hover:bg-white/30 text-white"}`} aria-label={isOnHold ? "Resume" : "Hold"}>
            <Pause className="h-5 w-5" />
          </Button>
        )}

        {onTransferCall && (
          <Button onClick={onTransferCall} size="icon" className="h-12 w-12 rounded-full bg-white/20 hover:bg-white/30 text-white" aria-label="Share call">
            <Forward className="h-5 w-5" />
          </Button>
        )}

        <Button onClick={onEndCall} size="icon" className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-400 text-white shadow-lg" aria-label="End call">
          <Phone className="h-6 w-6 rotate-[135deg]" />
        </Button>

        {onToggleParticipants && (
          <Button onClick={onToggleParticipants} size="icon" variant="ghost" className="h-11 w-11 rounded-full text-white hover:bg-white/15" aria-label="Participants">
            <Users className="h-5 w-5" />
          </Button>
        )}

        <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-medium text-white/80 shrink-0">
          You
        </div>
      </div>
    </motion.div>
  );
}
