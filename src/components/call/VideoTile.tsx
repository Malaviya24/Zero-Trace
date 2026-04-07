import { useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";

interface VideoTileProps {
  stream: MediaStream | null;
  displayName: string;
  isLocal?: boolean;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean;
  className?: string;
}

export function VideoTile({
  stream,
  displayName,
  isLocal = false,
  isAudioEnabled = true,
  isVideoEnabled = true,
  className = "",
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((error) => {
        console.error("Failed to play video:", error);
      });
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <div className={`relative overflow-hidden border-2 border-[#3f3f46] bg-[#111217] text-[#fafafa] [font-family:Space_Grotesk,_Inter,_sans-serif] ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`h-full w-full object-cover ${!isVideoEnabled || !stream ? "hidden" : ""}`}
      />

      {(!isVideoEnabled || !stream) ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#111217]">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center border-2 border-[#3f3f46] bg-[#18181b] text-2xl font-bold uppercase tracking-[0.08em] text-[#dfe104]">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.08em]">{displayName}</p>
          </div>
        </div>
      ) : null}

      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
        <span className={`flex h-8 w-8 items-center justify-center border ${isAudioEnabled ? "border-[#3f3f46] bg-[#18181b] text-[#fafafa]" : "border-red-500 bg-red-500/15 text-red-400"}`}>
          {isAudioEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
        </span>
        <span className={`flex h-8 w-8 items-center justify-center border ${isVideoEnabled ? "border-[#3f3f46] bg-[#18181b] text-[#fafafa]" : "border-red-500 bg-red-500/15 text-red-400"}`}>
          {isVideoEnabled ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
        </span>
      </div>

      <div className="absolute bottom-2 right-2 border border-[#3f3f46] bg-[#09090b] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#fafafa]">
        {displayName}
        {isLocal ? " / You" : ""}
      </div>
    </div>
  );
}
