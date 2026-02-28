import { Button } from "@/components/ui/button";
import { Phone, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router";
import { useState } from "react";

interface CallNotificationProps {
  callId: string;
  callerName: string;
  roomId?: string;
  displayName?: string;
  onDismiss: () => void;
}

export function CallNotification({ callId, callerName, roomId, displayName, onDismiss }: CallNotificationProps) {
  const navigate = useNavigate();
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinCall = () => {
    setIsJoining(true);
    if (displayName) {
      sessionStorage.setItem("call_display_name", displayName);
    }
    if (roomId) {
      sessionStorage.setItem("call_room_id", roomId);
    }
    navigate(`/call/${callId}`);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="bg-emerald-500 text-white px-4 py-2.5 flex items-center gap-3"
      >
        <div className="relative flex-shrink-0">
          <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            <Phone className="h-4 w-4" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {callerName} started a call
          </p>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <Button
            onClick={handleJoinCall}
            disabled={isJoining}
            size="sm"
            className="bg-white text-emerald-600 hover:bg-white/90 h-8 px-4 text-xs font-semibold rounded-full"
          >
            {isJoining ? "Joining..." : "Join"}
          </Button>
          <Button
            onClick={onDismiss}
            disabled={isJoining}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 rounded-full text-white/80 hover:text-white hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
