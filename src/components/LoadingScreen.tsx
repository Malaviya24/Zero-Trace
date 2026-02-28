import { motion, AnimatePresence } from "framer-motion";
import { Shield, Lock, MessageSquare } from "lucide-react";

interface LoadingScreenProps {
  message?: string;
  submessage?: string;
  variant?: "splash" | "page" | "inline" | "overlay";
  show?: boolean;
}

export function LoadingScreen({
  message = "Loading...",
  submessage,
  variant = "page",
  show = true,
}: LoadingScreenProps) {
  if (variant === "inline") {
    return (
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center py-12 gap-4"
          >
            <div className="loading-logo-ring">
              <div className="loading-logo-inner">
                <Shield className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{message}</p>
              {submessage && (
                <p className="text-xs text-muted-foreground mt-1">{submessage}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  if (variant === "overlay") {
    return (
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-5"
            >
              <div className="loading-logo-ring">
                <div className="loading-logo-inner">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">{message}</p>
                {submessage && (
                  <p className="text-sm text-muted-foreground mt-1.5">{submessage}</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  const isSplash = variant === "splash";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-background"
        >
          <div className="loading-bg-glow" />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative z-10 flex flex-col items-center gap-8"
          >
            <div className={isSplash ? "loading-logo-ring loading-logo-lg" : "loading-logo-ring"}>
              {/* No logo inside the ring for splash screen */}
            </div>

            <div className="text-center space-y-2">
              {isSplash && (
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl font-bold gradient-text"
                >
                  Zero-Trace
                </motion.h1>
              )}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: isSplash ? 0.5 : 0.2 }}
                className="font-medium text-foreground"
              >
                {message}
              </motion.p>
              {submessage && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: isSplash ? 0.6 : 0.3 }}
                  className="text-sm text-muted-foreground"
                >
                  {submessage}
                </motion.p>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: isSplash ? 0.7 : 0.3, duration: 0.4 }}
              className="loading-progress-track"
            >
              <div className="loading-progress-bar" />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
