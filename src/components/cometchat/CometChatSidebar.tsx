import React, { useState } from 'react';
import { Search, LogOut, Hash } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface CometChatSidebarProps {
  currentUser: {
    id: string;
    name: string;
    avatar?: string;
    status?: 'online' | 'offline' | 'away';
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
  onKick
}: CometChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredParticipants = participants.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="p-4 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-10 w-10 ring-2 ring-white dark:ring-slate-800 shadow-sm">
              <AvatarImage src={currentUser.avatar} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {currentUser.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white dark:ring-slate-900" />
          </div>
          <div className="flex flex-col">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 leading-tight">
              {currentUser.name}
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">Online</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 px-4 sticky top-[73px] bg-white/50 dark:bg-slate-900/50 backdrop-blur-md z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search" 
            className="pl-9 h-9 bg-slate-100 dark:bg-slate-800 border-none focus-visible:ring-1 focus-visible:ring-primary/20 transition-all rounded-xl"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Lists */}
      <ScrollArea className="flex-1 px-2">
        <div className="py-2 space-y-6">
          
          {/* Active Room Section */}
          <div className="px-2">
            <h4 className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Active Room
            </h4>
            <div className="group flex items-center gap-3 p-2 rounded-xl bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors cursor-pointer border border-primary/10">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Hash className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className="font-medium text-sm truncate text-slate-900 dark:text-slate-100">
                    {roomName}
                  </span>
                  <span className="text-[10px] text-slate-400">Now</span>
                </div>
                <p className="text-xs text-slate-500 truncate">
                  {participants.length} members active
                </p>
              </div>
            </div>
          </div>

          {/* Members Section */}
          <div className="px-2">
            <h4 className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex justify-between items-center">
              <span>Members</span>
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded text-[10px]">
                {filteredParticipants.length}
              </span>
            </h4>
            <div className="space-y-0.5">
              {filteredParticipants.map((participant) => (
                <div 
                  key={participant.id}
                  className="group flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <div className="relative">
                    <Avatar className="h-9 w-9 ring-1 ring-slate-100 dark:ring-slate-800">
                      <AvatarImage src={participant.avatar} />
                      <AvatarFallback className="text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {participant.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {participant.isOnline && (
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-slate-900" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm truncate text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                        {participant.name}
                      </span>
                    </div>
                    {participant.isTyping && (
                      <p className="text-[10px] text-primary font-medium animate-pulse">
                        typing...
                      </p>
                    )}
                  </div>
                  {isAdmin && participant.id !== currentUser.id && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        onKick?.(participant.id);
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <Button 
          variant="outline" 
          className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border-slate-200 dark:border-slate-800"
          onClick={onLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Leave Room
        </Button>
      </div>
    </div>
  );
}
