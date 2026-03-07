import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { 
  Menu,
  Phone, 
  Video, 
  MoreVertical, 
  Search, 
  LogOut, 
  Trash2, 
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface CometChatHeaderProps {
  roomName: string;
  avatar?: string;
  subtitle?: string;
  onlineCount?: number;
  onCall?: (video: boolean) => void;
  onSearch?: () => void;
  onMore?: () => void;
  onToggleSidebar?: () => void;
  // Admin actions
  isAdmin?: boolean;
  onClearChat?: () => void;
  onDeleteRoom?: () => void;
  onLeaveRoom?: () => void;
  onCopyInvite?: () => void;
}

export function CometChatHeader({
  roomName,
  avatar,
  subtitle,
  onlineCount,
  onCall,
  onSearch,
  onToggleSidebar,
  isAdmin,
  onClearChat,
  onDeleteRoom,
  onLeaveRoom,
  onCopyInvite
}: CometChatHeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchToggle = () => {
    setIsSearchOpen(!isSearchOpen);
    if (isSearchOpen) {
      onSearch?.(); // Clear search or callback
    }
  };

  return (
    <div className="h-[73px] px-4 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
      
      {/* Left: Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 md:hidden"
          onClick={onToggleSidebar}
          aria-label="Open room details"
        >
          <Menu className="h-5 w-5" />
        </Button>
        {!isSearchOpen ? (
          <>
            <button
              type="button"
              className="flex items-center gap-3 min-w-0 flex-1 text-left"
              onClick={onToggleSidebar}
            >
            <div className="relative shrink-0">
              <Avatar className="h-10 w-10 ring-2 ring-slate-100 dark:ring-slate-800 shadow-sm">
                <AvatarImage src={avatar} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {roomName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {onlineCount && onlineCount > 0 && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-slate-900 flex items-center justify-center text-[8px] text-white font-bold">
                  {onlineCount}
                </span>
              )}
            </div>
            
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {roomName}
                </h2>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal bg-slate-100 dark:bg-slate-800 text-slate-500">
                  Room
                </Badge>
              </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {subtitle || "Tap here for room info"}
                </p>
              </div>
            </button>
          </>
        ) : (
          <div className="flex-1 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
             <Search className="h-4 w-4 text-slate-400" />
             <Input 
               autoFocus
               placeholder="Search messages..." 
               className="h-9 border-none bg-transparent focus-visible:ring-0 px-0"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               // For now, search is UI only until we implement filtering in ChatRoom
             />
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 md:gap-2">
        {!isSearchOpen && (
          <>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 text-primary hover:text-primary hover:bg-primary/10 rounded-full hidden md:flex"
              onClick={() => onCall?.(false)}
            >
              <Phone className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 text-primary hover:text-primary hover:bg-primary/10 rounded-full hidden md:flex"
              onClick={() => onCall?.(true)}
            >
              <Video className="h-5 w-5" />
            </Button>
            
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block" />
          </>
        )}

        <Button 
          variant={isSearchOpen ? "secondary" : "ghost"}
          size="icon" 
          className="h-9 w-9 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-full hidden sm:flex"
          onClick={handleSearchToggle}
        >
          {isSearchOpen ? <Check className="h-4 w-4" /> : <Search className="h-5 w-5" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-full">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Room Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={onCopyInvite}>
              <Copy className="mr-2 h-4 w-4" /> Copy Invite Link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCall?.(false)} className="md:hidden">
              <Phone className="mr-2 h-4 w-4" /> Voice Call
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCall?.(true)} className="md:hidden">
              <Video className="mr-2 h-4 w-4" /> Video Call
            </DropdownMenuItem>
            
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-red-500">Admin Zone</DropdownMenuLabel>
                <DropdownMenuItem onClick={onClearChat} className="text-red-500 focus:text-red-500">
                  <Trash2 className="mr-2 h-4 w-4" /> Clear Members
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDeleteRoom} className="text-red-500 focus:text-red-500">
                  <AlertTriangle className="mr-2 h-4 w-4" /> Delete Room
                </DropdownMenuItem>
              </>
            )}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLeaveRoom} className="text-red-500 focus:text-red-500">
              <LogOut className="mr-2 h-4 w-4" /> Leave Room
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
