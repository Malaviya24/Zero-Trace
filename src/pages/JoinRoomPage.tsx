import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";

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
    <div className="min-h-screen relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="space-y-6"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <Card className="glass border-primary/10 shadow-xl shadow-primary/5">
            <CardHeader>
              <CardTitle className="text-2xl font-bold gradient-text">Join a Room</CardTitle>
              <p className="text-sm text-muted-foreground">
                Enter the Room ID to join a secure chat
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="joinRoomId">Room ID</Label>
                <Input
                  id="joinRoomId"
                  placeholder="e.g. ABC12345"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                  maxLength={20}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && joinRoomId.trim()) {
                      setIsJoining(true);
                      navigate(`/join/${joinRoomId.trim()}`);
                    }
                  }}
                />
              </div>

              <Button
                className="w-full"
                disabled={isJoining || !joinRoomId.trim()}
                onClick={() => {
                  if (!joinRoomId.trim()) return;
                  setIsJoining(true);
                  navigate(`/join/${joinRoomId.trim()}`);
                }}
              >
                {isJoining ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Join Room
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
