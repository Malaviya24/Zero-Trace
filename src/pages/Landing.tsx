import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Shield,
  Eye,
  Timer,
  Key,
  Users,
  Zap,
  Lock,
  AlertTriangle,
  ArrowRight,
  Plus,
  LogIn,
  MessageSquare,
  Loader2,
  Sun,
  Moon,
  QrCode,
  Menu,
  ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { QRScanner } from "@/components/QRScanner";

export default function Landing() {
  const navigate = useNavigate();
  const [isOpeningCreate, setIsOpeningCreate] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [isJoiningInline, setIsJoiningInline] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // ignore
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  const blobY = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const blobY2 = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const spotlightOpacity = useTransform(scrollYProgress, [0, 1], [0.2, 0.08]);

  const features = [
    {
      icon: Shield,
      title: "End-to-End Encryption",
      description: "AES-256 encryption with client-side key generation. Your messages are encrypted before leaving your device.",
    },
    {
      icon: Timer,
      title: "Ephemeral by Design",
      description: "All data auto-expires in 2 hours. Self-destructing messages vanish 10 minutes after being read.",
    },
    {
      icon: Eye,
      title: "Zero Data Storage",
      description: "No personal data ever stored. Anonymous identities with no registration required.",
    },
    {
      icon: Key,
      title: "Advanced Privacy",
      description: "Panic mode (ESC key), automatic key rotation, and ephemeral messaging.",
    },
    {
      icon: Zap,
      title: "Real-time & Secure",
      description: "Instant messaging with WebSocket connections. No server logs or message history.",
    },
    {
      icon: Lock,
      title: "Room Protection",
      description: "Password-protected rooms with capacity limits. Share via QR codes or secure links.",
    },
  ];

  const faqs = [
    {
      question: "Do I need to create an account?",
      answer: "No. Zero-Trace is anonymous by default. Create a room and share the link—no sign-up required.",
    },
    {
      question: "Are messages end-to-end encrypted?",
      answer: "Yes. Messages are encrypted on your device and decrypted on the recipient's device. We can't read them.",
    },
    {
      question: "How long do rooms and messages last?",
      answer: "Rooms expire after 2 hours. If self-destruct is enabled, messages vanish 10 minutes after being read.",
    },
  ];

  const steps = [
    {
      number: "1",
      title: "Create a secure room",
      description: "One click to generate a private room with end-to-end encryption.",
      color: "from-primary to-purple-500",
    },
    {
      number: "2",
      title: "Share the link",
      description: "Invite with a single link or QR code—no sign-up required.",
      color: "from-purple-500 to-fuchsia-500",
    },
    {
      number: "3",
      title: "Chat and vanish",
      description: "Messages self-destruct; rooms auto-expire. Nothing remains.",
      color: "from-fuchsia-500 to-pink-500",
    },
  ];

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-background to-muted/20"
    >
      {/* Animated gradient orbs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 1.2 }}
        style={{ y: blobY }}
        className="pointer-events-none absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-primary/30 via-purple-500/20 to-transparent blur-3xl"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.25 }}
        transition={{ duration: 1.5 }}
        style={{ y: blobY2 }}
        className="pointer-events-none absolute -bottom-32 -right-32 h-[32rem] w-[32rem] rounded-full bg-gradient-to-tl from-fuchsia-500/25 via-purple-500/15 to-transparent blur-3xl"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.15, scale: 1 }}
        transition={{ duration: 2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 h-[20rem] w-[20rem] rounded-full bg-gradient-to-r from-violet-500/20 to-indigo-500/20 blur-3xl"
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 border-b glass"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/")}
            className="flex items-center gap-3"
          >
            <div className="flex flex-col items-start leading-tight">
              <span className="font-extrabold text-xl tracking-tight gradient-text">
                Zero-Trace
              </span>
              <span className="text-[11px] text-muted-foreground/80">Ephemeral Chat</span>
            </div>
          </motion.button>

          <div className="hidden sm:flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme} 
              aria-label="Toggle dark mode"
              className="rounded-full"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/join")}
              disabled={isJoining}
              className="rounded-full transition-transform active:scale-[0.98]"
            >
              {isJoining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Join Room
                </>
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/create")}
              disabled={isOpeningCreate}
              className="rounded-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 transition-transform active:scale-[0.98] text-white border-0"
            >
              {isOpeningCreate ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Room
                </>
              )}
            </Button>
          </div>

          <div className="sm:hidden flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className="rounded-full"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open navigation menu" className="rounded-full">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle className="gradient-text text-left">Quick Actions</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-3 px-1">
                  <Button
                    variant="outline"
                    className="w-full justify-start rounded-xl h-12"
                    onClick={() => navigate("/join")}
                    disabled={isJoining}
                  >
                    {isJoining ? (
                      <>
                        <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                        Opening...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="mr-3 h-4 w-4" />
                        Join Room
                      </>
                    )}
                  </Button>
                  <Button
                    className="w-full justify-start rounded-xl h-12 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white border-0"
                    onClick={() => navigate("/create")}
                    disabled={isOpeningCreate}
                  >
                    {isOpeningCreate ? (
                      <>
                        <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                        Opening...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-3 h-4 w-4" />
                        Create Room
                      </>
                    )}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </motion.div>

      {/* Hero Section */}
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 lg:pt-32 pb-16 sm:pb-20 lg:pb-28">
        <motion.div className="pointer-events-none absolute inset-0 -z-10 hidden sm:block">
          <motion.div
            style={{ opacity: spotlightOpacity }}
            className="mx-auto mt-12 h-56 w-[70%] rounded-full bg-primary/10 blur-3xl"
          />
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="space-y-8 text-center lg:text-left"
          >
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-primary/20 text-sm text-muted-foreground"
              >
                <Shield className="h-3.5 w-3.5 text-primary" />
                End-to-end encrypted
              </motion.div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
                Secure
                <br />
                <span className="gradient-text">Anonymous</span>
                <br />
                Chat Rooms
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Create or join encrypted chat rooms instantly. No accounts, no tracking, just secure conversations that vanish.
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Button
                size="lg"
                className="text-base sm:text-lg px-8 py-6 h-14 rounded-xl bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white border-0 shadow-lg shadow-primary/25"
                onClick={() => navigate("/create")}
              >
                Create Room
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base sm:text-lg px-8 py-6 h-14 rounded-xl glass border-primary/20 hover:border-primary/40"
                onClick={() => navigate("/join")}
              >
                Join Room
                <Users className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex items-center gap-6 justify-center lg:justify-start text-sm text-muted-foreground"
            >
              <span className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                No sign-up
              </span>
              <span className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                Auto-expiring
              </span>
              <span className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                AES-256
              </span>
            </motion.div>
          </motion.div>

          {/* Floating visual element */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="hidden lg:flex items-center justify-center"
          >
            <div className="relative">
              <motion.div
                animate={{ y: [-8, 8, -8] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="relative w-80 h-80"
              >
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 via-purple-500/10 to-fuchsia-500/20 blur-2xl" />
                <div className="relative glass rounded-3xl border border-primary/20 p-8 h-full flex flex-col justify-between gradient-border">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                        <Lock className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Secure Room</div>
                        <div className="text-xs text-muted-foreground">Encrypted • 3 members</div>
                      </div>
                    </div>
                    <div className="space-y-2 pt-2">
                      <div className="glass rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm max-w-[75%]">
                        Hey, is this secure? 🔐
                      </div>
                      <div className="glass rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-[80%] ml-auto bg-primary/10">
                        End-to-end encrypted!
                      </div>
                      <div className="glass rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm max-w-[70%]">
                        Messages vanish ✨
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4">
                    <Timer className="h-3.5 w-3.5" />
                    <span>Expires in 1h 42m</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features Grid */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ delay: 0.1 }}
        className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 sm:pb-28"
      >
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">
            Why <span className="gradient-text">Zero-Trace</span>?
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Privacy-first features designed to keep your conversations truly private.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: 0.05 * index }}
            >
              <Card className="h-full glass border-primary/10 hover:border-primary/25 transition-all duration-300 group">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/15 to-purple-500/10 flex items-center justify-center mb-4 group-hover:from-primary/25 group-hover:to-purple-500/20 transition-all duration-300">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-base mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* How It Works Section */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5 }}
        className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 sm:pb-28"
      >
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">
            How it <span className="gradient-text">Works</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Create. Share. Chat. Everything disappears automatically.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              whileInView={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 24 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * index }}
              className="relative glass rounded-2xl border border-primary/10 p-6 sm:p-8 text-center group hover:border-primary/25 transition-all duration-300"
            >
              <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center mx-auto mb-5 text-white font-bold text-xl shadow-lg`}>
                {step.number}
              </div>
              <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* FAQ Section */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl mx-auto px-4 sm:px-6 pb-20 sm:pb-28"
      >
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">
            Frequently <span className="gradient-text">Asked</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Quick answers about privacy and usage
          </p>
        </div>
        <div className="glass rounded-2xl border border-primary/10 divide-y divide-primary/10">
          {faqs.map((faq, index) => (
            <div key={index}>
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left text-base font-medium hover:text-primary transition-colors"
              >
                {faq.question}
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${openFaq === index ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence initial={false}>
                {openFaq === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Security Promise */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5 }}
        className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 sm:pb-28"
      >
        <div className="relative glass rounded-3xl border border-primary/15 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
          <div className="relative p-8 sm:p-12 text-center">
            <div className="flex items-center justify-center gap-3 mb-5">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Zero Trust <span className="gradient-text">Architecture</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              We can't read your messages even if we wanted to. Everything is encrypted on your device
              before transmission, and all data automatically expires within 2 hours.
            </p>
            <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-lg mx-auto">
              <div>
                <div className="text-3xl sm:text-4xl font-bold gradient-text mb-1">0</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Personal Data Stored</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-bold gradient-text mb-1">2h</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Maximum Lifetime</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-bold gradient-text mb-1">∞</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Privacy Protection</div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="border-t border-primary/10"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-bold gradient-text text-sm">Zero-Trace</span>
          <p className="text-xs text-muted-foreground text-center">
            Built with privacy in mind. No tracking, no analytics, no data collection.
          </p>
          <p className="text-xs text-muted-foreground">© 2025 Zero-Trace</p>
        </div>
      </motion.footer>

      {/* QR Scanner Modal */}
      {showQRScanner && <QRScanner onClose={() => setShowQRScanner(false)} />}
    </div>
  );
}
