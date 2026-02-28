import { Button } from "@/components/ui/button";
import { Mic, MicOff, Phone } from "lucide-react";
import { motion } from "framer-motion";

interface WhatsAppCallControlsProps {
  isAudioEnabled: boolean;
  onToggleAudio: () => void;
  onEndCall: () => void;
}

export function WhatsAppCallControls({
  isAudioEnabled,
  onToggleAudio,
  onEndCall,
}: WhatsAppCallControlsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="flex items-center justify-center gap-8"
    >
      {/* Mute/Unmute Button */}
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button
          onClick={onToggleAudio}
          size="lg"
          className={`h-16 w-16 rounded-full shadow-2xl transition-all duration-200 ${
            isAudioEnabled
              ? "bg-white/20 hover:bg-white/30 backdrop-blur-sm"
              : "bg-red-500 hover:bg-red-600"
          }`}
          aria-label={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
        >
          {isAudioEnabled ? (
            <Mic className="h-7 w-7 text-white" />
          ) : (
            <MicOff className="h-7 w-7 text-white" />
          )}
        </Button>
      </motion.div>

      {/* End Call Button */}
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button
          onClick={onEndCall}
          size="lg"
          className="h-20 w-20 rounded-full bg-red-500 hover:bg-red-600 shadow-2xl transition-all duration-200"
          aria-label="End call"
        >
          <Phone className="h-8 w-8 text-white rotate-[135deg]" />
        </Button>
      </motion.div>
    </motion.div>
  );
}
