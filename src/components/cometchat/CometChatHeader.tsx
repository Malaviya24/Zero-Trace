import React, { useEffect, useRef, useState } from "react";
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
  Check,
} from "lucide-react";

import { SiteAvatar, SiteBadge, SiteButton, SiteInput } from "@/components/site/SitePrimitives";

interface CometChatHeaderProps {
  roomName: string;
  avatar?: string;
  subtitle?: string;
  onlineCount?: number;
  onCall?: (video: boolean) => void;
  onSearch?: () => void;
  onMore?: () => void;
  onToggleSidebar?: () => void;
  isAdmin?: boolean;
  onClearMembers?: () => void;
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
  onClearMembers,
  onDeleteRoom,
  onLeaveRoom,
  onCopyInvite,
}: CometChatHeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [isMenuOpen]);

  const handleSearchToggle = () => {
    setIsSearchOpen((current) => !current);
    if (isSearchOpen) {
      onSearch?.();
    }
  };

  const menuActionBase =
    "w-full px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-[0.18em] transition-colors hover:bg-muted";

  return (
    <header className="sticky top-0 z-20 border-b-2 border-border bg-background/95 backdrop-blur-md">
      <div className="flex min-h-[88px] items-center justify-between gap-4 px-4 py-3 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <SiteButton
            variant="ghost"
            size="icon"
            className="h-11 w-11 border text-foreground hover:bg-muted md:hidden"
            onClick={onToggleSidebar}
            aria-label="Open room details"
          >
            <Menu className="h-5 w-5" />
          </SiteButton>

          {!isSearchOpen ? (
            <button type="button" className="flex min-w-0 flex-1 items-center gap-4 text-left" onClick={onToggleSidebar}>
              <div className="relative shrink-0">
                <SiteAvatar
                  src={avatar}
                  alt={roomName}
                  fallback={roomName.slice(0, 2).toUpperCase()}
                  className="h-12 w-12 bg-muted"
                  fallbackClassName="bg-muted text-sm font-bold uppercase tracking-[0.18em] text-accent"
                />
                <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center border border-black bg-accent px-1 text-[10px] font-bold text-black">
                  {onlineCount || 0}
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="truncate text-xl font-bold uppercase tracking-[-0.05em] text-foreground md:text-2xl">{roomName}</h2>
                  <SiteBadge className="bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Room</SiteBadge>
                </div>
                <p className="mt-1 truncate text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {subtitle || "Open room details"}
                </p>
              </div>
            </button>
          ) : (
            <div className="flex flex-1 items-center gap-3 border-b-2 border-border pb-2 animate-in fade-in slide-in-from-top-1">
              <Search className="h-4 w-4 text-accent" />
              <SiteInput
                autoFocus
                placeholder="Search messages"
                displayUppercase={false}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-11 border-none px-0 text-sm font-medium uppercase tracking-[0.14em] placeholder:text-muted"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isSearchOpen ? (
            <>
              <SiteButton
                variant="ghost"
                size="icon"
                className="hidden h-11 w-11 border text-foreground hover:bg-muted md:inline-flex"
                onClick={() => onCall?.(false)}
              >
                <Phone className="h-5 w-5" />
              </SiteButton>
              <SiteButton
                variant="ghost"
                size="icon"
                className="hidden h-11 w-11 border text-foreground hover:bg-muted md:inline-flex"
                onClick={() => onCall?.(true)}
              >
                <Video className="h-5 w-5" />
              </SiteButton>
            </>
          ) : null}

          <SiteButton
            variant="ghost"
            size="icon"
            className="hidden h-11 w-11 border text-foreground hover:bg-muted sm:inline-flex"
            onClick={handleSearchToggle}
          >
            {isSearchOpen ? <Check className="h-4 w-4" /> : <Search className="h-5 w-5" />}
          </SiteButton>

          <div className="relative" ref={menuRef}>
            <SiteButton
              variant="ghost"
              size="icon"
              className="h-11 w-11 border text-foreground hover:bg-muted"
              onClick={() => setIsMenuOpen((current) => !current)}
            >
              <MoreVertical className="h-5 w-5" />
            </SiteButton>

            {isMenuOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-60 border-2 border-border bg-background text-foreground">
                <div className="border-b border-border px-4 py-3 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  Room actions
                </div>
                <button
                  type="button"
                  className={menuActionBase}
                  onClick={() => {
                    setIsMenuOpen(false);
                    onCopyInvite?.();
                  }}
                >
                  <Copy className="mr-2 inline h-4 w-4" /> Copy invite link
                </button>
                <button
                  type="button"
                  className={`${menuActionBase} md:hidden`}
                  onClick={() => {
                    setIsMenuOpen(false);
                    onCall?.(false);
                  }}
                >
                  <Phone className="mr-2 inline h-4 w-4" /> Voice call
                </button>
                <button
                  type="button"
                  className={`${menuActionBase} md:hidden`}
                  onClick={() => {
                    setIsMenuOpen(false);
                    onCall?.(true);
                  }}
                >
                  <Video className="mr-2 inline h-4 w-4" /> Video call
                </button>

                {isAdmin ? (
                  <>
                    <div className="border-t border-border px-4 py-3 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-accent">
                      Admin zone
                    </div>
                    <button
                      type="button"
                      className={`${menuActionBase} text-red-400 hover:bg-muted hover:text-red-300`}
                      onClick={() => {
                        setIsMenuOpen(false);
                        onClearMembers?.();
                      }}
                    >
                      <Trash2 className="mr-2 inline h-4 w-4" /> Clear members
                    </button>
                    <button
                      type="button"
                      className={`${menuActionBase} text-red-400 hover:bg-muted hover:text-red-300`}
                      onClick={() => {
                        setIsMenuOpen(false);
                        onDeleteRoom?.();
                      }}
                    >
                      <AlertTriangle className="mr-2 inline h-4 w-4" /> Delete room
                    </button>
                  </>
                ) : null}

                <div className="border-t border-border">
                  <button
                    type="button"
                    className={`${menuActionBase} text-red-400 hover:bg-muted hover:text-red-300`}
                    onClick={() => {
                      setIsMenuOpen(false);
                      onLeaveRoom?.();
                    }}
                  >
                    <LogOut className="mr-2 inline h-4 w-4" /> Leave room
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
