import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { SiteButton, SiteInput, SitePanel } from "@/components/site/SitePrimitives";

export default function JoinRoomPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [joinRoomId, setJoinRoomId] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const roomFromUrl = searchParams.get("room");
    if (roomFromUrl) {
      setJoinRoomId(roomFromUrl.toUpperCase());
    }
  }, [searchParams]);

  return (
    <div className="min-h-dvh bg-[#09090b] text-[#fafafa] [font-family:Space_Grotesk,_Inter,_sans-serif]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(63,63,70,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(63,63,70,0.28) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      <div className="relative mx-auto max-w-[95vw] px-4 py-8 sm:py-10 md:px-8 md:py-14">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 sm:space-y-8">
          <SiteButton type="button" variant="outline" size="sm" onClick={() => navigate("/")} className="self-start bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back
          </SiteButton>

          <div className="grid gap-px bg-[#3f3f46] lg:grid-cols-[0.95fr_1.05fr]">
            <div className="bg-[#09090b] p-6 sm:p-8 md:p-12 lg:p-16">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[#dfe104] sm:text-xs sm:tracking-[0.28em]">Room entry</p>
              <h1 className="mt-4 text-[clamp(2.6rem,11vw,8rem)] font-bold uppercase leading-[0.82] tracking-[-0.08em]">
                Join by room id.
              </h1>
              <p className="mt-5 max-w-xl text-base text-[#a1a1aa] sm:text-lg md:text-xl">
                Paste the active room code and move directly into the encrypted join flow.
              </p>
            </div>

            <SitePanel className="bg-[#18181b] p-6 sm:p-8 md:p-12 lg:p-16">
              <div className="space-y-6 sm:space-y-8">
                <div>
                  <label htmlFor="joinRoomId" className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#a1a1aa] sm:text-xs sm:tracking-[0.24em]">
                    Room id
                  </label>
                  <SiteInput
                    id="joinRoomId"
                    placeholder="ABC12345"
                    value={joinRoomId}
                    onChange={(event) => setJoinRoomId(event.target.value.toUpperCase())}
                    maxLength={20}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && joinRoomId.trim()) {
                        setIsJoining(true);
                        navigate(`/join/${joinRoomId.trim()}`);
                      }
                    }}
                    className="mt-3 h-16 text-2xl tracking-[-0.04em] placeholder:text-[#52525b] focus:border-[#dfe104] sm:h-18 md:h-20 md:text-3xl"
                  />
                </div>

                <SiteButton
                  type="button"
                  size="lg"
                  disabled={isJoining || !joinRoomId.trim()}
                  onClick={() => {
                    if (!joinRoomId.trim()) return;
                    setIsJoining(true);
                    navigate(`/join/${joinRoomId.trim()}`);
                  }}
                  className="w-full"
                >
                  {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {isJoining ? "Joining" : "Join room"}
                </SiteButton>
              </div>
            </SitePanel>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
