import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, Shield } from "lucide-react";

interface LoadingScreenProps {
  message?: string;
  submessage?: string;
  variant?: "splash" | "page" | "inline" | "overlay";
  show?: boolean;
}

function LoadingCore({
  message,
  submessage,
  splash = false,
}: {
  message: string;
  submessage?: string;
  splash?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="w-full max-w-4xl border-2 border-[#3f3f46] bg-[#09090b] text-[#fafafa] [font-family:Space_Grotesk,_Inter,_sans-serif]"
    >
      <div className="grid gap-px bg-[#3f3f46] md:grid-cols-[1.15fr_0.85fr]">
        <div className="bg-[#09090b] p-8 md:p-12">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#dfe104]">
            {splash ? "Zero Trace" : "System state"}
          </p>
          <h1 className="mt-4 text-[clamp(2.8rem,10vw,8rem)] font-bold uppercase leading-[0.8] tracking-[-0.08em]">
            {message}
          </h1>
          {submessage ? <p className="mt-5 max-w-xl text-lg text-[#a1a1aa] md:text-xl">{submessage}</p> : null}
        </div>
        <div className="flex items-center justify-center bg-[#18181b] p-8 md:p-12">
          <div className="relative flex h-44 w-44 items-center justify-center border-2 border-[#3f3f46]">
            <div className="absolute inset-3 border border-[#3f3f46]" />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.8, ease: "linear", repeat: Infinity }}
              className="h-24 w-24 border-2 border-[#dfe104]"
            />
            <div className="absolute flex flex-col items-center gap-2">
              {splash ? <Shield className="h-6 w-6 text-[#dfe104]" /> : <Lock className="h-6 w-6 text-[#dfe104]" />}
              <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#fafafa]">ZT</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function LoadingScreen({
  message = "Loading",
  submessage,
  variant = "page",
  show = true,
}: LoadingScreenProps) {
  if (variant === "inline") {
    return (
      <AnimatePresence>
        {show ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex items-center justify-center py-10"
          >
            <div className="border-2 border-[#3f3f46] bg-[#09090b] px-6 py-5 text-center text-[#fafafa] [font-family:Space_Grotesk,_Inter,_sans-serif]">
              <div className="mb-3 flex justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
                  className="flex h-12 w-12 items-center justify-center border-2 border-[#dfe104]"
                >
                  <Shield className="h-4 w-4 text-[#dfe104]" />
                </motion.div>
              </div>
              <p className="text-sm font-bold uppercase tracking-[0.22em]">{message}</p>
              {submessage ? <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#a1a1aa]">{submessage}</p> : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    );
  }

  if (variant === "overlay") {
    return (
      <AnimatePresence>
        {show ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
          >
            <LoadingCore message={message} submessage={submessage} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    );
  }

  const isSplash = variant === "splash";

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[#09090b] px-4 py-6"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(63,63,70,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(63,63,70,0.28) 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />
          <div className="relative z-10 flex w-full justify-center">
            <LoadingCore message={message} submessage={submessage} splash={isSplash} />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function PageTransition({ children }: { children: ReactNode }) {
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

