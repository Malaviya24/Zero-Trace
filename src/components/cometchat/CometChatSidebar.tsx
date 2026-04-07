import React, { useState } from "react";
import { Search, LogOut, Hash } from "lucide-react";

import { SiteAvatar, SiteButton, SiteInput } from "@/components/site/SitePrimitives";

interface CometChatSidebarProps {
  currentUser: {
    id: string;
    name: string;
    avatar?: string;
    status?: "online" | "offline" | "away";
  };
  roomName: string;
  participants: Array<{
    id: string;
    name: string;
    avatar?: string;
    isOnline?: boolean;
    isTyping?: boolean;
  }>;
  onLogout?: () => void;
  isAdmin?: boolean;
  onKick?: (id: string) => void;
}

export function CometChatSidebar({
  currentUser,
  roomName,
  participants,
  onLogout,
  isAdmin,
  onKick,
}: CometChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredParticipants = participants.filter((participant) =>
    participant.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col bg-[#0f1013] text-foreground">
      <div className="border-b-2 border-border p-5">
        <div className="flex items-center gap-4 border-2 border-border bg-background p-4">
          <div className="relative">
            <SiteAvatar
              src={currentUser.avatar}
              alt={currentUser.name}
              fallback={currentUser.name.slice(0, 2).toUpperCase()}
              className="h-12 w-12 bg-muted"
              fallbackClassName="bg-muted text-sm font-bold uppercase tracking-[0.18em] text-accent"
            />
            <span className="absolute -bottom-1 -right-1 h-4 w-4 border border-black bg-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">You</p>
            <h3 className="truncate text-lg font-bold uppercase tracking-[-0.04em]">{currentUser.name}</h3>
            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Online</span>
          </div>
        </div>
      </div>

      <div className="border-b border-border p-4">
        <div className="relative">
          <Search className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-accent" />
          <SiteInput
            placeholder="Search members"
            displayUppercase={false}
            className="h-12 border-0 border-b-2 border-border pl-8 pr-0 text-sm font-medium uppercase tracking-[0.16em] placeholder:text-muted"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-8 p-4">
          <section className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Active room</p>
            <div className="border-2 border-border bg-background p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center border-2 border-border bg-muted text-accent">
                  <Hash className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Live now</p>
                  <h4 className="mt-2 truncate text-xl font-bold uppercase tracking-[-0.05em]">{roomName}</h4>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">{participants.length} members active</p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Members</p>
              <span className="border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                {filteredParticipants.length}
              </span>
            </div>
            <div className="space-y-2">
              {filteredParticipants.map((participant) => (
                <div key={participant.id} className="group flex items-center gap-3 border border-border bg-background px-3 py-3 transition-colors hover:border-accent hover:bg-[#111217]">
                  <div className="relative">
                    <SiteAvatar
                      src={participant.avatar}
                      alt={participant.name}
                      fallback={participant.name.slice(0, 2).toUpperCase()}
                      className="h-10 w-10 border bg-muted"
                      fallbackClassName="bg-muted text-xs font-bold uppercase tracking-[0.16em] text-foreground"
                    />
                    {participant.isOnline ? <span className="absolute -bottom-1 -right-1 h-3 w-3 border border-black bg-accent" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold uppercase tracking-[0.1em] text-foreground">{participant.name}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {participant.isTyping ? "Typing now" : participant.isOnline ? "Online" : "Idle"}
                    </p>
                  </div>
                  {isAdmin && participant.id !== currentUser.id ? (
                    <SiteButton
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 border border-transparent px-0 text-red-400 opacity-0 transition group-hover:opacity-100 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
                      onClick={(event) => {
                        event.stopPropagation();
                        onKick?.(participant.id);
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                    </SiteButton>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="border-t-2 border-border p-4">
        <SiteButton
          variant="outline"
          className="h-12 w-full justify-start bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300"
          onClick={onLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Leave room
        </SiteButton>
      </div>
    </div>
  );
}
