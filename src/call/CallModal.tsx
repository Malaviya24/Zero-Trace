import { useEffect, useRef } from "react";
import { ActiveCallScreen } from "@/components/whatsapp-call/ActiveCallScreen";
import { toast } from "sonner";

type Props = {
  open: boolean;
  remoteName: string;
  muted: boolean;
  speakerOn: boolean;
  onHold?: boolean;
  remoteStream: MediaStream | null;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onEndCall: () => void;
  onBindRemoteAudio: (el: HTMLAudioElement | null) => void;
};

export function CallModal({
  open,
  remoteName,
  muted,
  speakerOn,
  onHold = false,
  remoteStream,
  onToggleMute,
  onToggleSpeaker,
  onEndCall,
  onBindRemoteAudio,
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    onBindRemoteAudio(audioRef.current);
    return () => onBindRemoteAudio(null);
  }, [onBindRemoteAudio]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.srcObject = remoteStream;
    if (remoteStream) {
      audioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  if (!open) return null;

  return (
    <>
      <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />
      <ActiveCallScreen
        remoteName={remoteName}
        callStatus={onHold ? "reconnecting" : "connected"} // Mapping hold to reconnecting status visual or just connected
        isAudioEnabled={!muted}
        isVideoEnabled={false} // CallModal seems to be audio-only context usually
        isSpeakerEnabled={speakerOn}
        onToggleAudio={onToggleMute}
        onToggleVideo={() => toast.info("Video not available in overlay")}
        onToggleSpeaker={onToggleSpeaker}
        onEndCall={onEndCall}
      />
    </>
  );
}
