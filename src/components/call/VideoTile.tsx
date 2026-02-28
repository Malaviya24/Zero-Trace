import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      // Ensure video plays
      videoRef.current.play().catch(err => {
        console.error("Failed to play video:", err);
      });
    }
    
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <Card className={`relative overflow-hidden bg-muted ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover ${
          !isVideoEnabled || !stream ? "hidden" : ""
        }`}
      />
      
      {(!isVideoEnabled || !stream) && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-sm font-medium">{displayName}</p>
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 flex items-center gap-1">
        <Badge
          variant={isAudioEnabled ? "secondary" : "destructive"}
          className="text-xs"
        >
          {isAudioEnabled ? (
            <Mic className="h-3 w-3" />
          ) : (
            <MicOff className="h-3 w-3" />
          )}
        </Badge>
        
        <Badge
          variant={isVideoEnabled ? "secondary" : "destructive"}
          className="text-xs"
        >
          {isVideoEnabled ? (
            <Video className="h-3 w-3" />
          ) : (
            <VideoOff className="h-3 w-3" />
          )}
        </Badge>
      </div>

      <div className="absolute bottom-2 right-2">
        <Badge variant="outline" className="text-xs">
          {displayName}
          {isLocal && " (You)"}
        </Badge>
      </div>
    </Card>
  );
}
