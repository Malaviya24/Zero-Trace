import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface CallAvatarProps {
  displayName: string;
  isConnected: boolean;
}

export function CallAvatar({ displayName, isConnected }: CallAvatarProps) {
  return (
    <div className="relative">
      {/* Pulsing ring when calling */}
      {!isConnected && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-white/30"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.8, 0, 0.8],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-white/30"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.6, 0, 0.6],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.5,
            }}
          />
        </>
      )}
      
      {/* Avatar */}
      <Avatar className="h-32 w-32 border-4 border-white/20 shadow-2xl">
        <AvatarFallback className="text-5xl font-bold bg-white/10 text-white backdrop-blur-sm">
          {displayName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
