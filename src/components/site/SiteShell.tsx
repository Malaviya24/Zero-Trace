import { useEffect, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SiteShellProps {
  children: ReactNode;
  className?: string;
  showNoise?: boolean;
}

export function SiteShell({ children, className, showNoise = true }: SiteShellProps) {
  useEffect(() => {
    const root = document.documentElement;
    const previousSurface = root.dataset.surface;
    root.dataset.surface = "site";

    return () => {
      if (previousSurface) {
        root.dataset.surface = previousSurface;
        return;
      }
      delete root.dataset.surface;
    };
  }, []);

  return (
    <div className={cn("site-surface relative min-h-dvh overflow-x-clip bg-background text-foreground", className)}>
      {showNoise ? <div aria-hidden="true" className="site-noise-overlay" /> : null}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
