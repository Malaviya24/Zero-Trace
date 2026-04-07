import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { SiteButton, SiteInput, SitePanel } from "@/components/site/SitePrimitives";
import { SiteLoadingScreen } from "@/components/site/SiteLoadingScreen";
import { ArrowRight } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router";

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
      navigate(redirectAfterAuth || "/");
    }
  }, [authLoading, isAuthenticated, navigate, redirectAfterAuth]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a display name before continuing.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await signIn("anonymous");

      const startTime = Date.now();
      const timeout = 10000;
      let attempt = 0;

      while (Date.now() - startTime < timeout) {
        try {
          await updateName({ name: name.trim() });
          break;
        } catch (mutationError) {
          attempt += 1;
          if (Date.now() - startTime > timeout) {
            throw mutationError;
          }
          const delay = Math.min(1000, 200 * Math.pow(2, attempt));
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    } catch (submitError) {
      console.error("Sign-in error:", submitError);
      signOut();
      setError(submitError instanceof Error ? submitError.message : "Failed to sign in. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-[95vw] items-center px-4 py-8 sm:py-10 md:px-8 md:py-16 lg:py-20">
      <div className="grid w-full gap-px bg-border lg:grid-cols-[0.95fr_1.05fr]">
        <div className="bg-background p-6 sm:p-8 md:p-12 lg:p-16">
          <p className="site-kicker text-accent">Identity handoff</p>
          <h1 className="mt-4 text-[clamp(2.6rem,11vw,9rem)] font-bold uppercase leading-[0.82] tracking-[-0.08em]">
            Enter the network.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg md:text-2xl">
            Pick the name you want attached to the next room session. The room stays anonymous. The signal stays sharp.
          </p>
        </div>

        <SitePanel className="bg-muted p-6 sm:p-8 md:p-12 lg:p-16">
          <form className="space-y-6 sm:space-y-8" onSubmit={handleSubmit}>
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-muted-foreground sm:text-sm sm:tracking-[0.24em]">Display name</p>
              <SiteInput
                name="name"
                placeholder="Type your handle"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isLoading}
                autoFocus
                required
              />
            </div>

            {error ? <p className="text-sm uppercase tracking-[0.14em] text-red-400">{error}</p> : null}

            <div className="grid gap-px bg-border sm:grid-cols-2">
              <div className="bg-muted p-4">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs sm:tracking-[0.24em]">Mode</p>
                <p className="mt-3 text-lg font-bold uppercase tracking-[-0.05em] sm:text-xl">Anonymous entry</p>
              </div>
              <div className="bg-muted p-4">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs sm:tracking-[0.24em]">Storage</p>
                <p className="mt-3 text-lg font-bold uppercase tracking-[-0.05em] sm:text-xl">No persistent account wall</p>
              </div>
            </div>

            <SiteButton type="submit" size="lg" disabled={isLoading || !name.trim()} className="w-full sm:w-auto">
              {isLoading ? "Entering" : "Continue"}
              <ArrowRight className="h-5 w-5" />
            </SiteButton>
          </form>
        </SitePanel>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense fallback={<SiteLoadingScreen message="AUTH" submessage="Preparing anonymous entry." />}>
      <Auth {...props} />
    </Suspense>
  );
}
