import { Toaster } from "@/components/ui/sonner";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { InstrumentationProvider } from "@/instrumentation.tsx";
import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import { ConvexReactClient, useConvexAuth } from "convex/react";
import { StrictMode, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import "./index.css";
import "./types/global.d.ts";
import { CallProvider } from "@/call";
import { Button } from "@/components/ui/button";

const LandingPage = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("@/pages/Auth.tsx"));
const CreateRoomPage = lazy(() => import("@/pages/CreateRoomPage.tsx"));
const JoinRoomPage = lazy(() => import("@/pages/JoinRoomPage.tsx"));
const JoinRoomWithIdPage = lazy(() => import("@/pages/JoinRoomWithIdPage.tsx"));
const RoomPage = lazy(() => import("@/pages/RoomPage.tsx"));
const GroupCallPage = lazy(() => import("./pages/GroupCallPage.tsx"));
const NotFoundPage = lazy(() => import("./pages/NotFound.tsx"));
const ProfileSetupPage = lazy(() => import("./pages/ProfileSetup.tsx"));
const DashboardPage = lazy(() => import("./pages/Dashboard.tsx"));

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const hasConvex = typeof convexUrl === "string" && convexUrl.length > 0;
const convex = hasConvex ? new ConvexReactClient(convexUrl) : null;

function RouteFallback() {
  return (
    <div className="h-dvh flex items-center justify-center bg-background">
      <div className="h-6 w-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
    </div>
  );
}

function RouteElement({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function AuthBootstrap({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const isBootstrappingRef = useRef(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapAttempts, setBootstrapAttempts] = useState(0);

  const MAX_BOOTSTRAP_ATTEMPTS = 5;

  const startAnonymousBootstrap = useCallback(() => {
    if (isBootstrappingRef.current || isLoading || isAuthenticated) return;

    isBootstrappingRef.current = true;
    signIn("anonymous")
      .then(() => {
        setBootstrapError(null);
        setBootstrapAttempts(0);
        isBootstrappingRef.current = false;
      })
      .catch((error: unknown) => {
        console.error("Anonymous auth bootstrap failed:", error);
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Anonymous auth bootstrap failed. Check Convex auth environment variables.";

        setBootstrapAttempts((prev) => {
          const next = prev + 1;
          if (next >= MAX_BOOTSTRAP_ATTEMPTS) {
            setBootstrapError(message);
            isBootstrappingRef.current = false;
            return next;
          }
          const delay = Math.min(1000 * Math.pow(2, next - 1), 8000);
          window.setTimeout(() => {
            isBootstrappingRef.current = false;
            startAnonymousBootstrap();
          }, delay);
          return next;
        });
      });
  }, [isLoading, isAuthenticated, signIn]);

  useEffect(() => {
    if (bootstrapError || isLoading || isAuthenticated) return;
    startAnonymousBootstrap();
  }, [bootstrapError, isLoading, isAuthenticated, startAnonymousBootstrap]);

  if (bootstrapError) {
    return (
      <div className="h-dvh flex items-center justify-center bg-background px-6">
        <div className="max-w-xl rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Authentication Configuration Error</h2>
          <p className="text-sm text-muted-foreground">
            Anonymous sign-in failed. Verify Convex environment variable `JWT_PRIVATE_KEY` is set
            and functions are deployed.
          </p>
          <pre className="mt-4 max-h-48 overflow-auto rounded bg-muted p-3 text-xs">{bootstrapError}</pre>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Attempts: {bootstrapAttempts}/{MAX_BOOTSTRAP_ATTEMPTS}
            </p>
            <Button
              onClick={() => {
                setBootstrapError(null);
                setBootstrapAttempts(0);
                isBootstrappingRef.current = false;
                startAnonymousBootstrap();
              }}
            >
              Retry Authentication
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || (!isAuthenticated && isBootstrappingRef.current)) {
    return <RouteFallback />;
  }

  return <>{children}</>;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <RouteElement><LandingPage /></RouteElement>,
  },
  {
    path: "/setup",
    element: <RouteElement><ProfileSetupPage /></RouteElement>,
  },
  {
    path: "/dashboard",
    element: <RouteElement><DashboardPage /></RouteElement>,
  },
  {
    path: "/auth",
    element: <RouteElement><AuthPage /></RouteElement>,
  },
  {
    path: "/create",
    element: <RouteElement><CreateRoomPage /></RouteElement>,
  },
  {
    path: "/join",
    element: <RouteElement><JoinRoomPage /></RouteElement>,
  },
  {
    path: "/join/:roomId",
    element: <RouteElement><JoinRoomWithIdPage /></RouteElement>,
  },
  {
    path: "/room/:roomId",
    element: <RouteElement><RoomPage /></RouteElement>,
  },
  {
    path: "/call/:callId",
    element: <RouteElement><GroupCallPage /></RouteElement>,
  },
  {
    path: "*",
    element: <RouteElement><NotFoundPage /></RouteElement>,
  },
]);

// Initialize theme on app mount based on localStorage or OS preference
function initTheme() {
  try {
    const saved = localStorage.getItem("theme");
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", isDark);
  } catch {
    // fail silently
  }
}

initTheme();

function dismissSplash() {
  const splash = document.getElementById("splash-screen");
  if (splash) {
    splash.classList.add("fade-out");
    setTimeout(() => splash.remove(), 500);
  }
}

const MissingConfig = () => (
  <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at top, #0b0720, #080616)", color: "#fff" }}>
    <div style={{ maxWidth: 560, padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Missing configuration</div>
      <div style={{ opacity: 0.8, marginBottom: 16 }}>Set VITE_CONVEX_URL in your environment before running the app.</div>
      <div style={{ fontSize: 12, opacity: 0.6 }}>Add a .env file with VITE_CONVEX_URL or export it in your shell.</div>
    </div>
  </div>
);

const app = (
  <StrictMode>
    {import.meta.env.DEV ? <VlyToolbar /> : null}
    <InstrumentationProvider>
      <AppReady onReady={dismissSplash} />
      {hasConvex && convex ? (
        <ConvexAuthProvider client={convex}>
          <AuthBootstrap>
            <CallProvider>
              <RouterProvider router={router} />
              <Toaster />
            </CallProvider>
          </AuthBootstrap>
        </ConvexAuthProvider>
      ) : (
        <MissingConfig />
      )}
    </InstrumentationProvider>
  </StrictMode>
);

createRoot(document.getElementById("root")!).render(app);

function AppReady({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onReady, 300);
    return () => clearTimeout(timer);
  }, [onReady]);
  return null;
}
