import { motion } from "framer-motion";
import { Home, MessageCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-background">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, -15, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 -left-16 h-72 w-72 rounded-full bg-primary/8 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/4 -right-16 h-80 w-80 rounded-full bg-primary/6 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, 10, 0], y: [0, 10, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-primary/4 blur-3xl"
        />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center px-6 text-center max-w-lg">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
          className="mb-8 relative"
        >
          <div className="h-28 w-28 rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/10 shadow-lg shadow-primary/5">
            <MessageCircle className="h-12 w-12 text-primary/60" />
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
            className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-destructive/90 flex items-center justify-center shadow-md"
          >
            <span className="text-white text-xs font-bold">!</span>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h1 className="gradient-text text-8xl sm:text-9xl font-extrabold tracking-tighter leading-none">
            404
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mt-4 space-y-2"
        >
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
            Page not found
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-sm mx-auto">
            The page you're looking for doesn't exist or may have been moved. Let's get you back on track.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-10 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto"
        >
          <Button
            size="lg"
            onClick={() => navigate("/")}
            className="gap-2 w-full sm:w-auto rounded-xl h-12 px-8 shadow-lg shadow-primary/20"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate(-1)}
            className="gap-2 w-full sm:w-auto rounded-xl h-12 px-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-12 text-xs text-muted-foreground/50"
        >
          Chattrix — Secure Anonymous Chat
        </motion.p>
      </div>
    </div>
  );
}
