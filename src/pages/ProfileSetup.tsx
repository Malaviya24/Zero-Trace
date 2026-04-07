import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { ArrowRight } from "lucide-react";

import { SiteButton, SiteInput, SitePanel } from "@/components/site/SitePrimitives";
import { useAuth } from "@/hooks/use-auth";

const AVATARS = [
  "\u{1F575}\uFE0F",
  "\u{1F680}",
  "\u{1F6E1}\uFE0F",
  "\u{1F47E}",
  "\u{1F9E0}",
  "\u{1F916}",
  "\u{1F98A}",
  "\u{1F43A}",
  "\u{1F52E}",
  "\u{1F3A7}",
];

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [selectedAvatar, setSelectedAvatar] = useState(user?.image || AVATARS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      localStorage.setItem("user_name", name);
      localStorage.setItem("user_avatar", selectedAvatar);
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to setup profile:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[95vw] px-4 py-8 sm:py-10 md:px-8 md:py-14">
      <div className="grid gap-px bg-border lg:grid-cols-[0.9fr_1.1fr]">
        <div className="bg-background p-6 sm:p-8 md:p-12 lg:p-16">
          <p className="site-kicker text-accent">Profile shell</p>
          <h1 className="mt-4 text-[clamp(2.6rem,11vw,8rem)] font-bold uppercase leading-[0.82] tracking-[-0.08em]">
            Build the persona that enters the room.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg md:text-2xl">
            Pick a signal mark and a display name. The room stays anonymous, but people still need something to recognize.
          </p>
        </div>

        <SitePanel className="bg-muted p-6 sm:p-8 md:p-12 lg:p-16">
          <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col gap-5 border-b-2 border-border pb-6 sm:flex-row sm:items-center sm:gap-6">
              <motion.div
                key={selectedAvatar}
                initial={{ rotate: -8, scale: 0.92, opacity: 0.6 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                className="flex h-24 w-24 items-center justify-center border-2 border-border bg-background text-5xl sm:h-28 sm:w-28 sm:text-6xl"
              >
                {selectedAvatar}
              </motion.div>
              <div className="min-w-0">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs sm:tracking-[0.24em]">Live preview</p>
                <p className="mt-3 text-2xl font-bold uppercase tracking-[-0.05em] sm:text-3xl break-words">{name.trim() || "Unnamed operator"}</p>
              </div>
            </div>

            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs sm:tracking-[0.24em]">Choose an avatar</p>
              <div className="mt-4 grid grid-cols-5 gap-px bg-border">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar}
                    type="button"
                    onClick={() => setSelectedAvatar(avatar)}
                    className={`site-focus flex aspect-square items-center justify-center bg-background text-2xl transition-colors sm:text-3xl ${
                      selectedAvatar === avatar ? "bg-accent text-black" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {avatar}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="displayName" className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs sm:tracking-[0.24em]">
                Display name
              </label>
              <SiteInput
                id="displayName"
                placeholder="Type your handle"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </div>

            <SiteButton size="lg" onClick={handleContinue} disabled={!name.trim() || isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? "Saving profile" : "Enter dashboard"}
              <ArrowRight className="h-5 w-5" />
            </SiteButton>
          </div>
        </SitePanel>
      </div>
    </div>
  );
}
