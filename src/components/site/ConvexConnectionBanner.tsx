import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, WifiOff } from "lucide-react";
import { useConvexConnectionState } from "convex/react";
import { useEffect, useMemo, useState } from "react";

export function ConvexConnectionBanner() {
  const connectionState = useConvexConnectionState();
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== "undefined" ? !navigator.onLine : false));

  useEffect(() => {
    const syncOnlineState = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", syncOnlineState);
    window.addEventListener("offline", syncOnlineState);
    return () => {
      window.removeEventListener("online", syncOnlineState);
      window.removeEventListener("offline", syncOnlineState);
    };
  }, []);

  const banner = useMemo(() => {
    if (isOffline) {
      return {
        icon: WifiOff,
        title: "You are offline",
        detail: "Realtime sync will resume automatically when the network comes back.",
      };
    }

    const shouldShowReconnect =
      !connectionState.isWebSocketConnected &&
      (connectionState.connectionRetries > 0 || connectionState.hasEverConnected || connectionState.hasInflightRequests);

    if (!shouldShowReconnect) return null;

    return {
      icon: RefreshCw,
      title: connectionState.hasEverConnected ? "Realtime sync is reconnecting" : "Realtime backend is unreachable",
      detail: connectionState.hasEverConnected
        ? "The app is trying to restore the secure live connection."
        : "The interface is loaded, but live Convex data needs network or backend access.",
    };
  }, [connectionState, isOffline]);

  return (
    <AnimatePresence>
      {banner ? (
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="pointer-events-none fixed left-1/2 top-3 z-[120] w-[min(92vw,42rem)] -translate-x-1/2"
        >
          <div className="pointer-events-auto border-2 border-[#3f3f46] bg-[#09090b]/96 px-4 py-3 text-[#fafafa] backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <banner.icon className={`mt-0.5 h-4 w-4 shrink-0 ${banner.icon === RefreshCw ? "animate-spin text-[#dfe104]" : "text-amber-300"}`} />
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[#dfe104]">{banner.title}</p>
                <p className="mt-1 text-sm leading-6 text-[#a1a1aa]">{banner.detail}</p>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
