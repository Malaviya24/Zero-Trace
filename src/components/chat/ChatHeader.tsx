import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Shield, Users, Copy, AlertTriangle, LogOut, Loader2, Sun, Moon, MoreVertical, Phone, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { CallButton } from "@/components/call/CallButton";

interface Participant {
  _id: string;
  displayName: string;
  avatar: string;
  role?: string;
  isActive: boolean;
  isTyping?: boolean;
  typingUpdatedAt?: number;
}

interface ChatHeaderProps {
  roomId: string;
  displayName: string;
  participants: Participant[];
  adminParticipant: Participant | null;
  isAdmin: boolean;
  isDark: boolean;
  isCopyingInvite: boolean;
  isClearing: boolean;
  isClearingMembers: boolean;
  isLeaving: boolean;
  kickingId: string | null;
  onCopyInvite: () => void;
  onPanicMode: () => void;
  onClearMembers: () => void;
  onLeaveRoom: () => void;
  onToggleTheme: () => void;
  onKick: (participantId: string) => void;
}

export function ChatHeader({
  roomId,
  displayName,
  participants,
  adminParticipant,
  isAdmin,
  isDark,
  isCopyingInvite,
  isClearing,
  isClearingMembers,
  isLeaving,
  kickingId,
  onCopyInvite,
  onPanicMode,
  onClearMembers,
  onLeaveRoom,
  onToggleTheme,
  onKick,
}: ChatHeaderProps) {
  const navigate = useNavigate();
  const onlineCount = participants.filter(p => p.isActive).length;
  const typingParticipants = participants.filter(
    p => p.isTyping && p.displayName !== displayName && (p.typingUpdatedAt ?? 0) > Date.now() - 4000
  );

  return (
    <div className="bg-card/90 dark:bg-card/80 backdrop-blur-md border-b border-border/60 sticky top-0 z-20">
      <div className="px-3 sm:px-5 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="h-8 w-8 rounded-full p-0 flex-shrink-0 hover:bg-muted/60"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5 text-foreground/70" />
        </Button>

        <Sheet>
          <SheetTrigger asChild>
            <button className="flex items-center gap-3 flex-1 min-w-0 text-left group">
              <div className="relative flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card bg-emerald-500" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-semibold text-[15px] text-foreground truncate group-hover:text-primary transition-colors">
                  {roomId}
                </h1>
                <p className="text-[12px] text-muted-foreground truncate">
                  {typingParticipants.length > 0 ? (
                    <span className="text-emerald-500 font-medium">
                      {typingParticipants.length === 1
                        ? `${typingParticipants[0].displayName} is typing...`
                        : `${typingParticipants.length} people typing...`}
                    </span>
                  ) : (
                    <>
                      <span className="text-emerald-500">{onlineCount} online</span>
                      <span className="mx-1.5">·</span>
                      <span>{participants.length} participants</span>
                    </>
                  )}
                </p>
              </div>
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[88vw] sm:w-[400px] p-0 border-l border-border/50">
            <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/50">
              <SheetTitle className="flex items-center gap-3 text-base">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Participants</p>
                  <p className="text-xs text-muted-foreground font-normal">{onlineCount} online · {participants.length} total</p>
                </div>
              </SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100dvh-100px)]">
              <div className="py-2">
                {participants.map((participant) => (
                  <div
                    key={participant._id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center text-lg">
                        {participant.avatar}
                      </div>
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${participant.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/25'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {participant.displayName}
                        </p>
                        {participant.displayName === displayName && (
                          <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">You</span>
                        )}
                        {participant.role === "admin" && (
                          <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                            <Shield className="h-2.5 w-2.5" />
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
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
                        className="h-8 text-xs rounded-lg text-destructive hover:text-destructive hover:bg-destructive/8"
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
            </ScrollArea>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-1 flex-shrink-0">
          <CallButton roomId={roomId} displayName={displayName} />

          <Button
            variant="ghost"
            size="sm"
            onClick={onCopyInvite}
            disabled={isCopyingInvite}
            className="h-9 w-9 rounded-full p-0 hover:bg-muted/60"
            aria-label="Copy invite link"
          >
            {isCopyingInvite ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin text-muted-foreground" />
            ) : (
              <Copy className="h-[18px] w-[18px] text-muted-foreground" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleTheme}
            className="h-9 w-9 rounded-full p-0 hover:bg-muted/60 hidden sm:flex"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <Sun className="h-[18px] w-[18px] text-amber-500" />
            ) : (
              <Moon className="h-[18px] w-[18px] text-muted-foreground" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 rounded-full p-0 hover:bg-muted/60"
                aria-label="More options"
              >
                <MoreVertical className="h-[18px] w-[18px] text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-lg border-border/60">
              <DropdownMenuItem onClick={onCopyInvite} disabled={isCopyingInvite} className="rounded-lg">
                <Copy className="h-4 w-4 mr-2.5 text-muted-foreground" />
                Copy Invite Link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleTheme} className="rounded-lg sm:hidden">
                {isDark ? <Sun className="h-4 w-4 mr-2.5 text-amber-500" /> : <Moon className="h-4 w-4 mr-2.5 text-muted-foreground" />}
                {isDark ? "Light Mode" : "Dark Mode"}
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onClearMembers}
                    disabled={isClearing || isClearingMembers}
                    className="rounded-lg"
                  >
                    <Users className="h-4 w-4 mr-2.5 text-muted-foreground" />
                    {isClearingMembers ? "Clearing..." : "Clear All Members"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onPanicMode}
                    disabled={isClearing}
                    className="text-destructive focus:text-destructive rounded-lg"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2.5" />
                    {isClearing ? "Clearing..." : "Panic Mode"}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onLeaveRoom}
                disabled={isLeaving}
                className="text-destructive focus:text-destructive rounded-lg"
              >
                <LogOut className="h-4 w-4 mr-2.5" />
                {isLeaving ? "Leaving..." : "Leave Room"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
