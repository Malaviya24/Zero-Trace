import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Phone,
  Settings,
  Sparkles,
  Users,
  MessageSquare,
} from "lucide-react";
import { useCallStore } from "@/store/useCallStore";
import { formatDuration } from "@/lib/utils";
import { ConnectionQualityIndicator } from "./ConnectionQualityIndicator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CallControlsProps {
  onEndCall: () => void;
  onOpenSettings: () => void;
  onToggleParticipants?: () => void;
  onToggleChat?: () => void;
  showParticipants?: boolean;
  showChat?: boolean;
  unreadCount?: number;
}

export function CallControls({ 
  onEndCall, 
  onOpenSettings,
  onToggleParticipants,
  onToggleChat,
  showParticipants,
  showChat,
  unreadCount = 0,
}: CallControlsProps) {
  const { state, actions } = useCallStore();

  const handleToggleAudio = () => {
    actions.toggleAudio();
    if (state.localStream) {
      const audioTrack = state.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !state.isAudioEnabled;
      }
    }
  };

  const handleToggleVideo = () => {
    actions.toggleVideo();
    if (state.localStream) {
      const videoTrack = state.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !state.isVideoEnabled;
      }
    }
  };

  const handleToggleScreenShare = () => {
    if (state.isScreenSharing) {
      actions.stopScreenShare();
    } else {
      actions.startScreenShare();
    }
  };

  const handleToggleBackgroundBlur = () => {
    actions.setBackgroundBlur(!state.isBackgroundBlurred);
  };

  return (
    <div className="flex items-center justify-between gap-2 p-4 bg-card/80 backdrop-blur border-t">
      {/* Left side - Secondary controls */}
      <div className="flex items-center gap-2">
        {onToggleParticipants && (
          <Button
            variant={showParticipants ? "default" : "outline"}
            size="lg"
            onClick={onToggleParticipants}
            className="rounded-full h-12 w-12"
            title="Toggle participants"
          >
            <Users className="h-5 w-5" />
          </Button>
        )}
        
        {onToggleChat && (
          <Button
            variant={showChat ? "default" : "outline"}
            size="lg"
            onClick={onToggleChat}
            className="rounded-full h-12 w-12 relative"
            title="Toggle chat"
          >
            <MessageSquare className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        )}
      </div>

      {/* Center - Primary call controls */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {/* Connection quality indicator */}
        <ConnectionQualityIndicator 
          quality={state.connectionQuality} 
          className="mr-2"
        />
        <Button
          variant={state.isAudioEnabled ? "secondary" : "destructive"}
          size="lg"
          onClick={handleToggleAudio}
          className="rounded-full h-12 w-12"
        >
          {state.isAudioEnabled ? (
            <Mic className="h-5 w-5" />
          ) : (
            <MicOff className="h-5 w-5" />
          )}
        </Button>

        <Button
          variant={state.isVideoEnabled ? "secondary" : "destructive"}
          size="lg"
          onClick={handleToggleVideo}
          className="rounded-full h-12 w-12"
        >
          {state.isVideoEnabled ? (
            <Video className="h-5 w-5" />
          ) : (
            <VideoOff className="h-5 w-5" />
          )}
        </Button>

        <Button
          variant={state.isScreenSharing ? "default" : "secondary"}
          size="lg"
          onClick={handleToggleScreenShare}
          className="rounded-full h-12 w-12"
        >
          {state.isScreenSharing ? (
            <MonitorOff className="h-5 w-5" />
          ) : (
            <Monitor className="h-5 w-5" />
          )}
        </Button>

        <Button
          variant={state.isBackgroundBlurred ? "default" : "secondary"}
          size="lg"
          onClick={handleToggleBackgroundBlur}
          className="rounded-full h-12 w-12"
          title="Toggle background blur"
        >
          <Sparkles className="h-5 w-5" />
        </Button>

        <Button
          variant="outline"
          size="lg"
          onClick={onOpenSettings}
          className="rounded-full h-12 w-12"
        >
          <Settings className="h-5 w-5" />
        </Button>

        <Badge variant="secondary" className="px-3 py-1 ml-2">
          {formatDuration(state.callDuration)}
        </Badge>
      </div>

      {/* Right side - End call with confirmation */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="destructive"
            size="lg"
            className="rounded-full h-12 w-12 hover:scale-105 transition-transform"
          >
            <Phone className="h-5 w-5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="bg-gradient-to-br from-card to-card/95 backdrop-blur-sm border-destructive/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 ring-2 ring-destructive/20">
                <Phone className="h-5 w-5 text-destructive" />
              </div>
              End Call?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base pt-2">
              Are you sure you want to end this call? This action cannot be undone and all participants will be disconnected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="hover:bg-muted">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={onEndCall}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg hover:shadow-xl transition-all"
            >
              <Phone className="mr-2 h-4 w-4" />
              End Call
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}