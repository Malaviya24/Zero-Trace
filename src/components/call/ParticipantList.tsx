import { Users, Mic, MicOff, Video, VideoOff, Wifi, WifiOff, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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
    <div className={cn("flex flex-col h-full bg-gradient-to-b from-card to-card/95 border-l shadow-lg", className)}>
      <div className="p-4 border-b bg-muted/30 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-base tracking-tight">Participants</h3>
            <p className="text-xs text-muted-foreground">{participants.length} in call</p>
          </div>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {participants.map((participant, index) => (
            <motion.div
              key={participant._id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-all duration-200",
                "bg-gradient-to-r from-muted/40 to-muted/20 hover:from-muted/60 hover:to-muted/40",
                "border border-border/50 hover:border-border hover:shadow-md",
                participant.isLocal && "ring-2 ring-primary/20 bg-primary/5"
              )}
            >
              <div className="relative">
                <Avatar className="h-11 w-11 border-2 border-background shadow-sm">
                  <AvatarFallback className={cn(
                    "font-bold text-sm",
                    participant.isLocal 
                      ? "bg-gradient-to-br from-primary/20 to-primary/10 text-primary" 
                      : "bg-gradient-to-br from-muted to-muted/80"
                  )}>
                    {participant.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {participant.connectionStatus === "connected" && (
                  <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background shadow-sm" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-sm truncate">
                    {participant.displayName}
                  </p>
                  {participant.isLocal && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-medium">
                      You
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-1.5">
                  {participant.connectionStatus === "connected" ? (
                    <Badge variant="outline" className="text-[10px] h-5 px-2 border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400">
                      <Wifi className="h-2.5 w-2.5 mr-1" />
                      Connected
                    </Badge>
                  ) : participant.connectionStatus === "connecting" ? (
                    <Badge variant="outline" className="text-[10px] h-5 px-2 border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current mr-1" />
                      Connecting
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] h-5 px-2 border-destructive/30 bg-destructive/10 text-destructive">
                      <WifiOff className="h-2.5 w-2.5 mr-1" />
                      Disconnected
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "p-1.5 rounded-md transition-colors",
                  participant.isAudioEnabled 
                    ? "bg-muted/50 text-foreground" 
                    : "bg-destructive/10 text-destructive"
                )}>
                  {participant.isAudioEnabled ? (
                    <Mic className="h-3.5 w-3.5" />
                  ) : (
                    <MicOff className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className={cn(
                  "p-1.5 rounded-md transition-colors",
                  participant.isVideoEnabled 
                    ? "bg-muted/50 text-foreground" 
                    : "bg-destructive/10 text-destructive"
                )}>
                  {participant.isVideoEnabled ? (
                    <Video className="h-3.5 w-3.5" />
                  ) : (
                    <VideoOff className="h-3.5 w-3.5" />
                  )}
                </div>
              </div>

              {!participant.isLocal && onReconnectParticipant && participant.canReconnect && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={participant.reconnecting}
                  onClick={() => onReconnectParticipant(participant._id)}
                  className="h-8 border-white/20 bg-transparent px-2 text-xs text-white hover:bg-white/10"
                >
                  <RotateCcw className={cn("mr-1 h-3 w-3", participant.reconnecting && "animate-spin")} />
                  {participant.reconnecting ? "Reconnecting" : "Reconnect"}
                </Button>
              )}
            </motion.div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
