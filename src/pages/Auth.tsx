import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, User } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

interface AuthProps {
  redirectAfterAuth?: string;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const updateName = useMutation(api.users.updateName);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const redirect = redirectAfterAuth || "/";
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirectAfterAuth]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Please enter a display name.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await signIn("anonymous");
      
      // Retry updateName until user is created (max 10 seconds)
      const startTime = Date.now();
      const timeout = 10000;
      let attempt = 0;
      
      while (Date.now() - startTime < timeout) {
        try {
          await updateName({ name: name.trim() });
          break;
        } catch (e) {
          attempt++;
          if (Date.now() - startTime > timeout) throw e;
          // Exponential backoff with jitter
          const delay = Math.min(1000, 200 * Math.pow(2, attempt));
          await new Promise(r => setTimeout(r, delay));
        }
      }
      
    } catch (error) {
      console.error("Sign-in error:", error);
      
      // If name update failed, ensure we sign out so user can try again
      signOut();
      
      setError(
        error instanceof Error
          ? error.message
          : "Failed to sign in. Please try again.",
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/[0.03] blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-sm sm:max-w-md"
      >
        <Card className="glass border-primary/10 pb-0 shadow-xl shadow-primary/5">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center">
              <img
                src="./logo.svg"
                alt="Logo"
                width={64}
                height={64}
                className="rounded-lg mb-4 mt-4"
              />
            </div>
            <CardTitle className="text-2xl font-bold gradient-text">Welcome</CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter your display name to join
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent>
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    name="name"
                    placeholder="Display Name"
                    className="pl-9"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                    required
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  size="icon"
                  disabled={isLoading || !name.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-500">{error}</p>
              )}
            </CardContent>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense fallback={<LoadingScreen variant="page" message="Loading..." />}>
      <Auth {...props} />
    </Suspense>
  );
}
