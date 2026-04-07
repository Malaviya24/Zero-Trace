import { api } from "@/convex/_generated/api";
import { SiteBadge, SiteButton, SitePanel, SiteSectionHeading } from "@/components/site/SitePrimitives";
import { useQuery } from "convex/react";
import { Hash, Plus, Shield, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";

export default function Dashboard() {
  const navigate = useNavigate();
  const rooms = useQuery(api.rooms.list) || [];

  return (
    <div className="mx-auto max-w-[95vw] px-4 py-10 md:px-8 md:py-14">
      <div className="grid gap-12 border-b-2 border-border pb-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <SiteSectionHeading
          eyebrow="Room index"
          title={<>Current secure surfaces and the rooms waiting for traffic.</>}
          description="This dashboard keeps the language consistent with the public site while leaving the actual room interface untouched once someone crosses the threshold."
        />
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-end">
          <SiteButton size="lg" onClick={() => navigate("/create")}>
            <Plus className="h-5 w-5" />
            New room
          </SiteButton>
        </div>
      </div>

      <section className="py-10 md:py-14">
        <div className="grid gap-px bg-border md:grid-cols-3">
          <div className="bg-background p-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Live rooms</p>
            <p className="mt-4 text-[clamp(3rem,8vw,6rem)] font-bold uppercase leading-none tracking-[-0.08em]">{rooms.length}</p>
          </div>
          <div className="bg-background p-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Retention window</p>
            <p className="mt-4 text-[clamp(3rem,8vw,6rem)] font-bold uppercase leading-none tracking-[-0.08em]">2H</p>
          </div>
          <div className="bg-background p-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Identity model</p>
            <p className="mt-4 text-[clamp(3rem,8vw,6rem)] font-bold uppercase leading-none tracking-[-0.08em]">Anon</p>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="site-kicker text-accent">Active rooms</p>
            <h2 className="mt-2 text-[clamp(2.3rem,6vw,4.5rem)] font-bold uppercase leading-[0.86] tracking-[-0.06em]">
              Operational rooms on the network.
            </h2>
          </div>
          <SiteBadge>{rooms.length ? `${rooms.length} rooms online` : "No active rooms"}</SiteBadge>
        </div>

        {rooms.length ? (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {rooms.map((room, index) => (
              <motion.div
                key={room._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
              >
                <SitePanel
                  className="is-interactive group h-full cursor-pointer p-6"
                  onClick={() => navigate(`/room/${room.roomId}`)}
                >
                  <div className="flex h-full flex-col justify-between gap-8">
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-4xl font-bold uppercase leading-none tracking-[-0.06em] text-muted group-hover:text-black">
                          {room.roomId}
                        </p>
                        <Shield className="h-5 w-5 text-accent group-hover:text-black" />
                      </div>
                      <p className="mt-4 text-2xl font-bold uppercase leading-[0.9] tracking-[-0.05em]">
                        {room.name || "Untitled room"}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm uppercase tracking-[0.16em]">
                        <span className="site-panel-muted">Capacity</span>
                        <span>{room.maxParticipants}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm uppercase tracking-[0.16em]">
                        <span className="site-panel-muted">Mode</span>
                        <span>{room.settings?.selfDestruct ? "Self-destruct" : "Standard"}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm uppercase tracking-[0.16em]">
                        <span className="site-panel-muted">Entry</span>
                        <span className="inline-flex items-center gap-2">Open room <Users className="h-4 w-4" /></span>
                      </div>
                    </div>
                  </div>
                </SitePanel>
              </motion.div>
            ))}
          </div>
        ) : (
          <SitePanel className="p-8 md:p-12">
            <div className="grid gap-8 md:grid-cols-[0.4fr_1fr] md:items-center">
              <p className="site-number text-muted">00</p>
              <div>
                <p className="text-3xl font-bold uppercase leading-[0.9] tracking-[-0.05em] md:text-5xl">No active rooms are broadcasting right now.</p>
                <p className="mt-4 max-w-2xl text-lg text-muted-foreground md:text-xl">
                  Open a fresh encrypted room, define the rules, and send the invite link to the people who need it.
                </p>
                <div className="mt-6">
                  <SiteButton onClick={() => navigate("/create")}>
                    <Hash className="h-4 w-4" />
                    Create first room
                  </SiteButton>
                </div>
              </div>
            </div>
          </SitePanel>
        )}
      </section>
    </div>
  );
}
