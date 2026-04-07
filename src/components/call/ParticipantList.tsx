import { motion } from "framer-motion";
import { Mic, MicOff, RotateCcw, Users, Video, VideoOff, Wifi, WifiOff } from "lucide-react";

import { Avatar, AvatarFallback, Button, ScrollArea } from "@/components/app/AppUI";
import { cn } from "@/lib/utils";

interface Participant {
  _id: string;
  displayName: string;
  isLocal?: boolean;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean;
  connectionStatus?: "connected" | "connecting" | "disconnected";
  canReconnect?: boolean;
  reconnecting?: boolean;
}

interface ParticipantListProps {
  participants: Participant[];
  className?: string;
  onReconnectParticipant?: (participantId: string) => void;
}

export function ParticipantList({ participants, className, onReconnectParticipant }: ParticipantListProps) {
  return (
    <div className={cn("flex h-full flex-col bg-[#09090b] text-[#fafafa] [font-family:Space_Grotesk,_Inter,_sans-serif]", className)}>
      <div className="border-b-2 border-[#3f3f46] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center border-2 border-[#3f3f46] bg-[#18181b] text-[#dfe104]">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold uppercase tracking-[-0.04em]">Participants</h3>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a1a1aa]">{participants.length} in call</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 p-3">
          {participants.map((participant, index) => (
            <motion.div
              key={participant._id}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04 }}
              className={cn(
                "border border-[#3f3f46] bg-[#111217] p-3",
                participant.isLocal ? "border-[#dfe104]" : "hover:bg-[#17181c]"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-11 w-11 rounded-none border-2 border-[#3f3f46] bg-[#18181b]">
                    <AvatarFallback className={cn(
                      "rounded-none text-sm font-bold uppercase tracking-[0.16em]",
                      participant.isLocal ? "bg-[#dfe104] text-black" : "bg-[#18181b] text-[#fafafa]"
                    )}>
                      {participant.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {participant.connectionStatus === "connected" ? <div className="absolute -bottom-1 -right-1 h-3 w-3 border border-black bg-[#dfe104]" /> : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold uppercase tracking-[0.08em]">{participant.displayName}</p>
                    {participant.isLocal ? <span className="border border-[#3f3f46] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a1a1aa]">You</span> : null}
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1 border border-[#3f3f46] bg-[#09090b] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a1a1aa]">
                    {participant.connectionStatus === "connected" ? <Wifi className="h-3 w-3 text-[#dfe104]" /> : participant.connectionStatus === "connecting" ? <span className="inline-block h-2 w-2 animate-pulse bg-[#dfe104]" /> : <WifiOff className="h-3 w-3 text-red-400" />}
                    {participant.connectionStatus || "unknown"}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className={cn("flex h-8 w-8 items-center justify-center border", participant.isAudioEnabled ? "border-[#3f3f46] bg-[#18181b] text-[#fafafa]" : "border-red-500 bg-red-500/15 text-red-400")}>
                    {participant.isAudioEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                  </div>
                  <div className={cn("flex h-8 w-8 items-center justify-center border", participant.isVideoEnabled ? "border-[#3f3f46] bg-[#18181b] text-[#fafafa]" : "border-red-500 bg-red-500/15 text-red-400")}>
                    {participant.isVideoEnabled ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
                  </div>
                </div>
              </div>

              {!participant.isLocal && onReconnectParticipant && participant.canReconnect ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={participant.reconnecting}
                  onClick={() => onReconnectParticipant(participant._id)}
                  className="mt-3 h-9 rounded-none border-[#3f3f46] bg-transparent px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#fafafa] hover:bg-[#18181b]"
                >
                  <RotateCcw className={cn("mr-2 h-3.5 w-3.5", participant.reconnecting && "animate-spin")} />
                  {participant.reconnecting ? "Reconnecting" : "Reconnect"}
                </Button>
              ) : null}
            </motion.div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}


