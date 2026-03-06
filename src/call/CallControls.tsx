import { Button } from "@/components/ui/button";
import { Forward, Mic, MicOff, Pause, PhoneOff, Volume2, VolumeX } from "lucide-react";

type Props = {
  muted: boolean;
  speakerOn: boolean;
  onHold?: boolean;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onToggleHold?: () => void;
  onTransferCall?: () => void;
  onEndCall: () => void;
};

export function CallControls({
  muted,
  speakerOn,
  onHold = false,
  onToggleMute,
  onToggleSpeaker,
  onToggleHold,
  onTransferCall,
  onEndCall,
}: Props) {
  return (
    <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3 backdrop-blur-xl flex items-center justify-center gap-2 sm:gap-3">
      <Button size="icon" className={muted ? "h-11 w-11 rounded-full bg-amber-500 hover:bg-amber-400 text-black" : "h-11 w-11 rounded-full bg-slate-700 hover:bg-slate-600"} onClick={onToggleMute} aria-label={muted ? "Unmute microphone" : "Mute microphone"}>
        {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </Button>
      <Button size="icon" className="h-11 w-11 rounded-full bg-slate-700 hover:bg-slate-600" onClick={onToggleSpeaker} aria-label={speakerOn ? "Disable speaker" : "Enable speaker"}>
        {speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
      </Button>
      {onToggleHold && (
        <Button size="icon" className={`h-11 w-11 rounded-full ${onHold ? "bg-indigo-500 hover:bg-indigo-400" : "bg-slate-700 hover:bg-slate-600"}`} onClick={onToggleHold} aria-label={onHold ? "Resume call" : "Hold call"}>
          <Pause className="h-5 w-5" />
        </Button>
      )}
      {onTransferCall && (
        <Button size="icon" className="h-11 w-11 rounded-full bg-slate-700 hover:bg-slate-600" onClick={onTransferCall} aria-label="Transfer call">
          <Forward className="h-5 w-5" />
        </Button>
      )}
      <Button size="icon" className="h-12 w-12 rounded-full bg-red-500 hover:bg-red-400" onClick={onEndCall} aria-label="End call">
        <PhoneOff className="h-5 w-5" />
      </Button>
    </div>
  );
}
