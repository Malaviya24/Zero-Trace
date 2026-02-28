import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Loader2, Users } from "lucide-react";

interface Participant {
  _id: string;
  displayName: string;
  avatar: string;
  role?: string;
  isActive: boolean;
  isTyping?: boolean;
  typingUpdatedAt?: number;
}

interface ParticipantSidebarProps {
  participants: Participant[];
  isAdmin: boolean;
  onKick: (participantId: string) => void;
  kickingId: string | null;
  roomId: string;
}

export function ParticipantSidebar({ participants, isAdmin, onKick, kickingId }: ParticipantSidebarProps) {
  const onlineCount = participants.filter(p => p.isActive).length;

  return (
    <div className="hidden lg:flex lg:flex-col w-72 xl:w-80 border-l border-border/50 bg-card/70 dark:bg-card/50 backdrop-blur-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Participants</h3>
            <p className="text-[11px] text-muted-foreground">{onlineCount} online</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {participants.map((participant) => (
          <div
            key={participant._id}
            className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/25 transition-colors group"
          >
            <div className="relative flex-shrink-0">
              <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-base">
                {participant.avatar}
              </div>
              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-card ${participant.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/25'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">{participant.displayName}</p>
                {participant.role === "admin" && (
                  <span className="text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                    <Shield className="h-2 w-2" />
                    Admin
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {participant.isTyping && (participant.typingUpdatedAt ?? 0) > Date.now() - 4000 ? (
                  <span className="text-emerald-500 font-medium">typing...</span>
                ) : participant.isActive ? (
                  <span className="text-emerald-500">Online</span>
                ) : "Offline"}
              </p>
            </div>
            {isAdmin && participant.role !== "admin" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onKick(participant._id)}
                disabled={kickingId === participant._id}
                className="h-7 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/8"
              >
                {kickingId === participant._id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Remove"
                )}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
