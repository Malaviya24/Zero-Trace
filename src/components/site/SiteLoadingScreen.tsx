import { motion } from "framer-motion";

interface SiteLoadingScreenProps {
  message?: string;
  submessage?: string;
}

export function SiteLoadingScreen({
  message = "LOADING",
  submessage = "Aligning the next surface.",
}: SiteLoadingScreenProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-6 md:py-20">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-4xl border-2 border-border bg-background"
      >
        <div className="grid gap-px bg-border lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-background p-6 sm:p-8 md:p-12">
            <p className="site-kicker text-accent">System boot</p>
            <h1 className="mt-4 text-[clamp(2.6rem,11vw,9rem)] font-bold uppercase leading-[0.84] tracking-[-0.08em]">
              {message}
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg md:text-xl">{submessage}</p>
          </div>
          <div className="flex items-center justify-center bg-muted p-6 sm:p-8 md:p-12">
            <div className="relative flex h-36 w-36 items-center justify-center border-2 border-border sm:h-44 sm:w-44 md:h-48 md:w-48">
              <div className="absolute inset-3 border border-border" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
                className="h-20 w-20 border-2 border-accent sm:h-24 sm:w-24 md:h-28 md:w-28"
              />
              <span className="absolute text-xs font-bold uppercase tracking-[0.28em] text-accent">ZT</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
