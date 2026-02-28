import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CreateRoom from "@/components/CreateRoom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";

export default function CreateRoomPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 sm:py-12">
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
              <CardTitle className="text-2xl font-bold gradient-text">Create a Secure Room</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure your ephemeral, end‑to‑end encrypted chat room
              </p>
            </CardHeader>
            <CardContent>
              <CreateRoom />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
