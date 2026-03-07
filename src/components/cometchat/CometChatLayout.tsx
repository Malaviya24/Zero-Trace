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
  onToggleSidebar
}: CometChatLayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans">
      {/* Mobile Sidebar Overlay */}
      {showSidebarMobile && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onToggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col",
          showSidebarMobile ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebar}
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm">
        {children}
      </main>

      {/* Right Details Panel (Desktop Only) */}
      {details && (
        <aside className="hidden xl:flex w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex-col">
          {details}
        </aside>
      )}
    </div>
  );
}
