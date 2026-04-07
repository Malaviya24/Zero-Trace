import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ChevronDown, Lock, Shield, Timer, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import {
  SiteBadge,
  SiteButton,
  SiteMarquee,
  SitePanel,
  SiteSectionHeading,
} from "@/components/site/SitePrimitives";

const featureCards = [
  {
    number: "01",
    title: "Encrypted before send",
    description:
      "Keys live with the room, not the server. Messages are encrypted on-device before they leave the browser.",
  },
  {
    number: "02",
    title: "Rooms erase themselves",
    description:
      "Rooms expire after two hours and can run self-destructing message windows for tighter operational hygiene.",
  },
  {
    number: "03",
    title: "No identity ceremony",
    description:
      "Open a room, share the link, talk, leave. No signup queue, no profile wall, no persistent contact graph.",
  },
];

const workflow = [
  {
    label: "Create",
    body: "Spin up a room with a name, password, participant cap, and privacy settings in one pass.",
  },
  {
    label: "Share",
    body: "Send the invite link or QR entry point and keep the encryption key attached to the handoff.",
  },
  {
    label: "Vanish",
    body: "The room burns out on schedule so the conversation does not linger after the moment passes.",
  },
];

const faqs = [
  {
    question: "Do I need an account?",
    answer: "No. The flow is anonymous-first. Open a room and move immediately into the conversation.",
  },
  {
    question: "Can the server read messages?",
    answer: "No. Messages are encrypted before transport and decrypted on the participant side with the room key.",
  },
  {
    question: "How long does data stay alive?",
    answer: "Rooms expire after two hours, and optional self-destruct settings tighten message retention further.",
  },
  {
    question: "What happens if I close the tab?",
    answer: "Your session drops out, but the room keeps running until its expiry window or until the owner destroys it.",
  },
  {
    question: "Can I join from phone or tablet?",
    answer: "Yes. The interface is tuned for mobile, tablet, and desktop so the room handoff stays readable everywhere.",
  },
  {
    question: "Can I move from chat to a call instantly?",
    answer: "Yes. Rooms are built to escalate from text into voice or video without sending people through a second setup flow.",
  },
];

const fieldNotes = [
  ["Anonymous entry", "Share the room, not a profile. People arrive with room-scoped identity only."],
  ["Mobile ready", "Invite links, controls, and retention settings stay readable on phones and tablets."],
  ["Fast shutdown", "Owners can rely on expiry windows and destruction controls instead of lingering archives."],
] as const;

const heroSignals = [
  ["No accounts", "Anonymous entry with room-scoped identity only"],
  ["Fast invite", "Share by link or QR without setup ceremony"],
  ["Short retention", "Rooms expire automatically after two hours"],
  ["Direct controls", "Password gates, expiry rules, and kill switches"],
] as const;

const roomPreview = [
  ["Access", "Link or QR handoff"],
  ["Encryption", "Client-side before transit"],
  ["Expiry", "Two hour room lifetime"],
  ["Fallback", "Move from chat to call instantly"],
] as const;

export default function Landing() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const heroScale = useTransform(scrollYProgress, [0, 0.18], reduceMotion ? [1, 1] : [1, 1.02]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.18], reduceMotion ? [1, 1] : [1, 0.96]);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const statItems = useMemo(
    () => [
      <><span className="site-number text-[clamp(3.5rem,9vw,7rem)] text-black">256</span><span>Bit AES pipeline</span></>,
      <><span className="site-number text-[clamp(3.5rem,9vw,7rem)] text-black">02</span><span>Hour room lifetime</span></>,
      <><span className="site-number text-[clamp(3.5rem,9vw,7rem)] text-black">00</span><span>Accounts required</span></>,
      <><span className="site-number text-[clamp(3.5rem,9vw,7rem)] text-black">50</span><span>Message key rotation default</span></>,
    ],
    []
  );

  const promiseItems = useMemo(
    () => [
      <><span>Zero tracking</span><span className="text-muted-foreground">Anonymous handles only</span></>,
      <><span>Zero archives</span><span className="text-muted-foreground">Ephemeral rooms by default</span></>,
      <><span>Zero compromise theater</span><span className="text-muted-foreground">Direct controls for destruction and access</span></>,
      <><span>Zero clutter</span><span className="text-muted-foreground">Focused surfaces across phone, tablet, and desktop</span></>,
    ],
    []
  );

  return (
    <div className="relative">
      <header className="sticky top-0 z-30 border-b-2 border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[95vw] items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div>
            <p className="site-kicker text-accent">Zero-Trace</p>
            <p className="text-[0.68rem] uppercase tracking-[0.24em] text-muted-foreground md:text-xs">Secure anonymous rooms</p>
          </div>
          <div className="ml-auto flex items-center gap-2 md:gap-4">
            <SiteButton size="sm" onClick={() => navigate("/create")}>
              Create room
            </SiteButton>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b-2 border-border px-4 py-6 sm:py-8 md:px-8 md:py-14 lg:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-6 hidden text-[clamp(5rem,14vw,14rem)] font-bold leading-none tracking-[-0.1em] text-muted/60 md:block lg:right-10 lg:top-8"
          >
            01
          </div>

          <motion.div
            style={{ scale: heroScale, opacity: heroOpacity }}
            className="mx-auto grid max-w-[95vw] gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-end"
          >
            <div className="space-y-6 py-4 md:space-y-8 md:py-10 lg:py-14">
              <SiteBadge className="border-accent text-accent">Secure transient communication</SiteBadge>
              <div className="max-w-[22rem] space-y-5 md:max-w-3xl md:space-y-6">
                <h1 className="site-display max-w-[10ch] text-[clamp(3.25rem,8.5vw,8.5rem)]">
                  Secure rooms that <span className="text-accent">disappear</span> when the work is done.
                </h1>
                <p className="site-copy max-w-2xl text-foreground/80">
                  Zero-Trace gives teams a sharper place to talk: encrypted room handoff, short retention, instant entry,
                  and a calmer interface that stays readable on phones, tablets, and desktops.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <SiteButton size="lg" onClick={() => navigate("/create")}>
                  Open secure room
                  <ArrowRight className="h-5 w-5" />
                </SiteButton>
              </div>

              <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
                {heroSignals.map(([label, copy]) => (
                  <div key={label} className="bg-background p-4 sm:p-5">
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-foreground md:text-xs md:tracking-[0.24em]">
                      {label}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground/72 md:text-base">{copy}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-stretch lg:justify-end">
              <SitePanel className="w-full overflow-hidden p-0">
                <div className="flex flex-col gap-5 border-b-2 border-border px-5 py-5 md:px-7 md:py-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="site-kicker text-accent">Room preview</p>
                      <p className="mt-3 text-2xl font-bold uppercase leading-[0.92] tracking-[-0.05em] md:text-4xl">
                        Encrypted entry without the usual friction.
                      </p>
                    </div>
                    <div className="border border-border px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-muted-foreground md:text-[0.7rem]">
                      Live
                    </div>
                  </div>
                  <p className="max-w-xl text-sm leading-6 text-foreground/78 md:text-base">
                    Build a room, share the key, and let the session expire on schedule. The interface stays product-focused
                    instead of decorative.
                  </p>
                </div>

                <div className="grid gap-px bg-border lg:grid-cols-[0.78fr_1.22fr]">
                  <div className="flex flex-col justify-between gap-6 bg-muted p-5 md:p-7">
                    <div>
                      <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-muted-foreground md:text-xs md:tracking-[0.24em]">
                        Retention window
                      </p>
                      <p className="site-number mt-3 text-[clamp(4.25rem,10vw,7.5rem)] text-foreground">02H</p>
                    </div>
                    <p className="max-w-sm text-sm leading-6 text-foreground/72 md:text-base">
                      Automatic room expiry and optional self-destruct rules keep conversations short-lived by default.
                    </p>
                  </div>

                  <div className="bg-background p-5 md:p-7">
                    <div className="grid gap-y-4">
                      {roomPreview.map(([label, copy], index) => (
                        <div
                          key={label}
                          className={`grid gap-2 ${index !== 0 ? "border-t border-border pt-4" : ""} md:grid-cols-[0.34fr_1fr] md:items-start`}
                        >
                          <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-muted-foreground md:text-xs md:tracking-[0.24em]">
                            {label}
                          </p>
                          <p className="text-lg font-bold uppercase leading-[0.95] tracking-[-0.04em] md:text-2xl">{copy}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-px bg-border sm:grid-cols-3">
                  {[
                    ["Ready in", "seconds"],
                    ["Works on", "phone and desktop"],
                    ["Escalates to", "voice or video calls"],
                  ].map(([label, copy]) => (
                    <div key={label} className="bg-background p-4 sm:p-5">
                      <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-muted-foreground md:text-xs md:tracking-[0.24em]">
                        {label}
                      </p>
                      <p className="mt-2 text-base font-bold uppercase tracking-[-0.04em] md:text-lg">{copy}</p>
                    </div>
                  ))}
                </div>
              </SitePanel>
            </div>
          </motion.div>
        </section>

        <SiteMarquee inverted speed="fast" items={statItems} />

        <section id="systems" className="mx-auto max-w-[95vw] px-4 py-16 md:px-8 md:py-24 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.88fr_1.12fr]">
            <div className="space-y-8">
              <SiteSectionHeading
                eyebrow="Security posture"
                title={<>Typography is the structure. Privacy is the payload.</>}
                description="The public product surfaces move with confidence while the room mechanics stay operational and direct. Sharp borders, strong contrast, no ornamental blur."
              />
              <div className="space-y-4 border-l-4 border-accent pl-4 md:pl-5">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.24em] text-accent md:text-sm md:tracking-[0.22em]">
                  Operating principles
                </p>
                <p className="site-copy text-muted-foreground">
                  Every surface is tuned around one system: rich black foundation, off-white type, zinc structure lines,
                  and acid yellow only where the interface needs a clear signal.
                </p>
              </div>
            </div>
            <div className="space-y-4 md:space-y-5">
              {featureCards.map((feature, index) => (
                <motion.div
                  key={feature.number}
                  initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                  className="lg:sticky lg:top-24"
                >
                  <SitePanel className="is-interactive group p-5 md:p-8 lg:p-10">
                    <div className="grid gap-5 md:grid-cols-[0.28fr_1fr] md:items-start">
                      <p className="site-number text-muted group-hover:text-black">{feature.number}</p>
                      <div className="space-y-3 md:space-y-4">
                        <p className="text-2xl font-bold uppercase leading-[0.92] tracking-[-0.06em] md:text-4xl lg:text-5xl">
                          {feature.title}
                        </p>
                        <p className="site-panel-muted max-w-2xl text-base leading-7 text-muted-foreground md:text-lg lg:text-xl">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </SitePanel>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y-2 border-border bg-accent px-4 py-16 text-black md:px-8 md:py-20 lg:py-24">
          <div className="mx-auto grid max-w-[95vw] gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
            <div>
              <p className="site-kicker text-black">How the cycle works</p>
              <h2 className="mt-4 text-[clamp(2.5rem,8vw,7rem)] font-bold uppercase leading-[0.84] tracking-[-0.08em]">
                Create. Share. Disappear.
              </h2>
            </div>
            <div className="site-grid">
              {workflow.map((step, index) => (
                <div key={step.label} className="grid gap-4 bg-accent p-5 md:grid-cols-[0.22fr_1fr] md:p-7 lg:p-8">
                  <p className="text-5xl font-bold leading-none tracking-[-0.08em] md:text-6xl lg:text-7xl">0{index + 1}</p>
                  <div>
                    <p className="text-2xl font-bold uppercase tracking-[-0.05em] md:text-3xl lg:text-4xl">{step.label}</p>
                    <p className="mt-3 text-base leading-7 md:text-lg lg:text-xl">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <SiteMarquee speed="slow" items={promiseItems} />

        <section className="mx-auto max-w-[95vw] px-4 py-16 md:px-8 md:py-24 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div className="space-y-6 lg:sticky lg:top-24">
              <SiteSectionHeading
                eyebrow="Field notes"
                title={<>Questions that matter before you hand the room to someone else.</>}
                description="The rules are simple: anonymous access, room-scoped key sharing, short lifetimes, and explicit destruction controls."
              />
              <div className="grid gap-px bg-border sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {fieldNotes.map(([label, copy]) => (
                  <div key={label} className="bg-background p-4 sm:p-5">
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-accent md:text-xs md:tracking-[0.24em]">
                      {label}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-foreground/76 md:text-base">{copy}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-2 border-border">
              {faqs.map((faq, index) => (
                <div key={faq.question} className="border-b-2 border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpenFaq((current) => (current === index ? null : index))}
                    className="site-focus flex w-full items-center justify-between gap-4 px-4 py-5 text-left md:px-7 md:py-6"
                  >
                    <span className="text-lg font-bold uppercase leading-[0.98] tracking-[-0.05em] md:text-2xl lg:text-3xl">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 transition-transform ${openFaq === index ? "rotate-180 text-accent" : "text-muted-foreground"}`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaq === index ? (
                      <motion.div
                        initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                        animate={reduceMotion ? undefined : { height: "auto", opacity: 1 }}
                        exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <p className="px-4 pb-6 text-base leading-7 text-muted-foreground md:px-7 md:pb-7 md:text-lg lg:text-xl">
                          {faq.answer}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t-2 border-border px-4 py-14 md:px-8 md:py-20 lg:py-24">
          <div className="mx-auto grid max-w-[95vw] gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="site-kicker text-accent">Open the room</p>
              <h2 className="mt-4 text-[clamp(2.4rem,7vw,6rem)] font-bold uppercase leading-[0.86] tracking-[-0.08em]">
                Privacy should feel immediate, not ceremonial.
              </h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <SiteButton size="lg" onClick={() => navigate("/create")}>
                Launch room
                <ArrowRight className="h-5 w-5" />
              </SiteButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-border px-4 py-8 md:px-8">
        <div className="mx-auto flex max-w-[95vw] flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.22em] text-muted-foreground">
            <Shield className="h-4 w-4 text-accent" />
            Zero-Trace network
          </div>
          <div className="flex flex-wrap gap-4 text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground md:text-xs md:tracking-[0.2em]">
            <span className="inline-flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> End-to-end encrypted</span>
            <span className="inline-flex items-center gap-2"><Timer className="h-3.5 w-3.5" /> Two hour room lifetime</span>
            <span className="inline-flex items-center gap-2"><Zap className="h-3.5 w-3.5" /> Real-time delivery</span>
          </div>
        </div>
      </footer>
    </div>
  );
}



