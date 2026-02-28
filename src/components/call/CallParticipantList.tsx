import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Wifi, WifiOff, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface Participant {
  _id: string;
  displayName: string;
  role: "admin" | "member";
  joinedAt?: number;
}

interface CallParticipantListProps {
  participants: Participant[];
  myDisplayName: string;
  connectionStatus: "idle" | "connecting" | "connected" | "disconnected" | "error";
}

export function CallParticipantList({ 
  participants, 
  myDisplayName,
  connectionStatus 
}: CallParticipantListProps) {
  return (
    <Card className="h-full shadow-lg border-border/50">
      <CardHeader className="pb-3 bg-gradient-to-r from-muted/30 to-muted/10 border-b">
        <CardTitle className="flex items-center gap-3 text-base">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="font-bold tracking-tight">Participants</span>
            <span className="text-xs text-muted-foreground ml-2">({participants.length})</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-4">
        {participants.map((participant, index) => {
          const isMe = participant.displayName === myDisplayName;
          const isConnected = connectionStatus === "connected";
          
          return (
            <motion.div
              key={participant._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-all duration-200",
                "bg-gradient-to-r from-muted/30 to-muted/10 hover:from-muted/50 hover:to-muted/30",
                "border border-border/30 hover:border-border/60 hover:shadow-sm",
                isMe && "ring-2 ring-primary/20 bg-primary/5"
              )}
            >
              <div className="relative">
                <Avatar className={cn(
                  "h-9 w-9 border-2 shadow-sm transition-all",
                  isMe ? "border-primary/30" : "border-background"
                )}>
                  <AvatarFallback className={cn(
                    "text-xs font-bold",
                    isMe 
                      ? "bg-gradient-to-br from-primary/20 to-primary/10 text-primary" 
                      : participant.role === "admin"
                      ? "bg-gradient-to-br from-amber-500/20 to-amber-500/10 text-amber-700 dark:text-amber-400"
                      : "bg-gradient-to-br from-muted to-muted/70"
                  )}>
                    {participant.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isConnected && (
                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background shadow-sm" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-sm font-semibold truncate">
                    {participant.displayName}
                  </p>
                  {isMe && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-medium">
                      You
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {isConnected ? (
                    <>
                      <Wifi className="h-3 w-3 text-green-500" />
                      <span className="text-[11px] text-green-600 dark:text-green-400 font-medium">
                        Connected
                      </span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">
                        Connecting...
                      </span>
                    </>
                  )}
                </div>
              </div>
              
              {participant.role === "admin" && (
                <Badge 
                  variant="outline" 
                  className="text-[10px] h-6 px-2 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold"
                >
                  <Crown className="h-2.5 w-2.5 mr-1" />
                  Host
                </Badge>
              )}
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
