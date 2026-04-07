import React from 'react';

import { cn } from "@/lib/utils";

interface CometChatLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  details?: React.ReactNode;
  showSidebarMobile?: boolean;
  onToggleSidebar?: () => void;
}

export function CometChatLayout({
  children,
  sidebar,
  details,
  showSidebarMobile = false,
  onToggleSidebar,
}: CometChatLayoutProps) {
  return (
    <div className="room-shell flex h-screen w-full overflow-hidden bg-[#09090b] text-[#fafafa] [font-family:Space_Grotesk,_Inter,_sans-serif]">
      {showSidebarMobile ? (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden" onClick={onToggleSidebar} />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[22rem] flex-col border-r-2 border-[#3f3f46] bg-[#0f1013] transition-transform duration-300 ease-out md:relative md:translate-x-0",
          showSidebarMobile ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebar}
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col bg-[#09090b]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(63,63,70,0.32) 1px, transparent 1px), linear-gradient(90deg, rgba(63,63,70,0.32) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">{children}</div>
      </main>

      {details ? (
        <aside className="hidden w-80 border-l-2 border-[#3f3f46] bg-[#0f1013] xl:flex xl:flex-col">{details}</aside>
      ) : null}
    </div>
  );
}
