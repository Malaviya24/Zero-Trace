import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Sparkles, User } from "lucide-react";

const AVATARS = [
  "👨‍💻", "👩‍💻", "🕵️", "🦸", "🦹", "🧟", "🧛", "🧞", "🧝", "🧚",
  "🐶", "🐱", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷"
];

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [selectedAvatar, setSelectedAvatar] = useState(user?.image || "🕵️");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      // Simulate saving profile or actually update user if auth supports it
      // For anonymous auth, we might just store in local storage or update context
      // Assuming signIn or similar updates the context/backend
      // For this demo, we'll assume successful local state update and navigate
      localStorage.setItem("user_name", name);
      localStorage.setItem("user_avatar", selectedAvatar);
      
      // If we have a backend update mutation, call it here
      // await updateProfile({ name, image: selectedAvatar });

      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to setup profile:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-primary/10 shadow-2xl bg-card/50 backdrop-blur-xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">
              Create Your Persona
            </CardTitle>
            <p className="text-muted-foreground">
              Choose how you appear in the Zero Trace network.
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Avatar Selection */}
            <div className="space-y-4">
              <div className="flex justify-center">
                <motion.div
                  key={selectedAvatar}
                  initial={{ scale: 0.8, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="relative"
                >
                  <Avatar className="w-32 h-32 border-4 border-primary/20 shadow-xl">
                    <AvatarImage src="" /> {/* Using emoji as image for now */}
                    <AvatarFallback className="text-6xl bg-secondary">
                      {selectedAvatar}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-2 rounded-full shadow-lg">
                    <User className="w-4 h-4" />
                  </div>
                </motion.div>
              </div>
              
              <div className="grid grid-cols-5 gap-2 p-2 bg-muted/30 rounded-xl">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar}
                    onClick={() => setSelectedAvatar(avatar)}
                    className={`text-2xl p-2 rounded-lg transition-all hover:bg-background/80 hover:scale-110 ${
                      selectedAvatar === avatar ? "bg-background shadow-md scale-110 ring-2 ring-primary/20" : "opacity-70"
                    }`}
                  >
                    {avatar}
                  </button>
                ))}
              </div>
            </div>

            {/* Name Input */}
            <div className="space-y-2">
              <Input
                placeholder="Enter your display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 text-lg text-center bg-background/50 border-primary/10 focus:border-primary/30 transition-all"
                autoFocus
              />
            </div>

            <Button
              size="lg"
              className="w-full h-12 text-lg font-medium shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]"
              onClick={handleContinue}
              disabled={!name.trim() || isSubmitting}
            >
              {isSubmitting ? "Setting up..." : "Enter the Network"}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
