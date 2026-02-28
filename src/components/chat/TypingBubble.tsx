import { motion, AnimatePresence } from "framer-motion";

interface TypingBubbleProps {
  typingUsers: string[];
}

export function TypingBubble({ typingUsers }: TypingBubbleProps) {
  if (typingUsers.length === 0) return null;

  const label =
    typingUsers.length === 1
      ? typingUsers[0]
      : typingUsers.length === 2
        ? `${typingUsers[0]} and ${typingUsers[1]}`
        : `${typingUsers[0]} and ${typingUsers.length - 1} others`;

  return (
    <AnimatePresence>
      {typingUsers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.97 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex items-end gap-2 px-1 py-0.5"
        >
          <div className="w-7 h-7 rounded-full bg-muted/60 flex items-center justify-center text-xs flex-shrink-0 border border-border/30">
            {typingUsers[0]?.charAt(0) || "?"}
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground/70 font-medium pl-2">
              {label}
            </span>
            <div className="typing-bubble">
              <div className="typing-dots">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
