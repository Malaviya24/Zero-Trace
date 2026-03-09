import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

const WARNING_COOLDOWN_MS = 4_000;
let lastWarningAt = 0;

function showProtectedWarning(message: string) {
  const now = Date.now();
  if (now - lastWarningAt < WARNING_COOLDOWN_MS) return;
  lastWarningAt = now;
  toast.warning(message);
}

function shouldAllowClipboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA";
}

export function ScreenShield({
  watermarkText,
  children,
  className,
}: {
  watermarkText: string;
  children: ReactNode;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [concealed, setConcealed] = useState(false);

  const watermarkImage = useMemo(() => {
    const safeText = encodeURIComponent(`${watermarkText} • Protected • ${new Date().toLocaleDateString()}`);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='240'><text x='20' y='120' fill='white' fill-opacity='0.24' font-size='18' font-family='Arial,sans-serif' transform='rotate(-20 210 120)'>${safeText}</text></svg>`;
    return `url("data:image/svg+xml,${svg}")`;
  }, [watermarkText]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onContextMenu = (event: MouseEvent) => {
      if (!root.contains(event.target as Node)) return;
      event.preventDefault();
    };

    const onDragStart = (event: DragEvent) => {
      if (!root.contains(event.target as Node)) return;
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === "IMG" || tag === "VIDEO" || tag === "AUDIO" || tag === "A") {
          event.preventDefault();
        }
      }
    };

    const onCopyCut = (event: ClipboardEvent) => {
      if (!root.contains(event.target as Node)) return;
      if (shouldAllowClipboardTarget(event.target)) return;
      event.preventDefault();
      showProtectedWarning("Copy and cut are restricted in protected mode.");
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const isPrintShortcut =
        event.key === "PrintScreen" ||
        (event.metaKey && event.shiftKey && (event.key === "3" || event.key === "4"));
      if (isPrintShortcut) {
        setConcealed(true);
        window.setTimeout(() => setConcealed(false), 1200);
        showProtectedWarning("Screen capture is restricted in protected mode.");
      }

      const isClipboardShortcut = (event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === "c" || event.key.toLowerCase() === "x");
      if (!isClipboardShortcut) return;
      if (!root.contains(document.activeElement)) return;
      if (shouldAllowClipboardTarget(document.activeElement)) return;
      event.preventDefault();
      showProtectedWarning("Copy and cut are restricted in protected mode.");
    };

    const onVisibilityChange = () => {
      setConcealed(document.visibilityState !== "visible");
    };

    const onBlur = () => setConcealed(true);
    const onFocus = () => setConcealed(false);
    const onBeforePrint = () => setConcealed(true);
    const onAfterPrint = () => setConcealed(false);

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("copy", onCopyCut);
    document.addEventListener("cut", onCopyCut);
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("copy", onCopyCut);
      document.removeEventListener("cut", onCopyCut);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

  return (
    <div ref={rootRef} className={cn("screen-shield-protected relative", className)}>
      <style>{`@media print { .screen-shield-protected { visibility: hidden !important; } }`}</style>
      {children}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-40 opacity-30 mix-blend-overlay"
        style={{
          backgroundImage: watermarkImage,
          backgroundRepeat: "repeat",
          backgroundSize: "420px 240px",
        }}
      />
      {concealed ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/94 text-center text-white">
          <div className="rounded-lg border border-white/20 bg-black/40 px-5 py-4 text-sm text-white/90 backdrop-blur">
            Protected mode active
          </div>
        </div>
      ) : null}
    </div>
  );
}
