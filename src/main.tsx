import { ConvexConnectionBanner } from "@/components/site/ConvexConnectionBanner";
import { SiteLoadingScreen } from "@/components/site/SiteLoadingScreen";
import { SiteShell } from "@/components/site/SiteShell";
import { SiteToaster } from "@/components/site/SiteToaster";
import { InstrumentationProvider } from "@/instrumentation.tsx";
import { CallProvider } from "@/call";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { StrictMode, Suspense, lazy, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import "./index.css";
import "./types/global.d.ts";

const LandingPage = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("@/pages/Auth.tsx"));
const CreateRoomPage = lazy(() => import("@/pages/CreateRoomPage.tsx"));
const JoinRoomPage = lazy(() => import("./pages/JoinRoomPage.tsx"));
const JoinRoomWithIdPage = lazy(() => import("./pages/JoinRoomWithIdPage.tsx"));
const RoomPage = lazy(() => import("./pages/RoomPage.tsx"));
const GroupCallPage = lazy(() => import("./pages/GroupCallPage.tsx"));
const NotFoundPage = lazy(() => import("./pages/NotFound.tsx"));
const ProfileSetupPage = lazy(() => import("./pages/ProfileSetup.tsx"));
const DashboardPage = lazy(() => import("./pages/Dashboard.tsx"));

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const hasConvex = typeof convexUrl === "string" && convexUrl.length > 0;
const convex = hasConvex ? new ConvexReactClient(convexUrl) : null;

function AppRouteFallback() {
  return (
    <SiteShell showNoise={false}>
      <SiteLoadingScreen message="LOADING" submessage="Preparing the next secure surface." />
    </SiteShell>
  );
}

function AppRouteElement({ children }: { children: ReactNode }) {
  return (
    <SiteShell showNoise={false}>
      <Suspense fallback={<AppRouteFallback />}>{children}</Suspense>
    </SiteShell>
  );
}

function SiteRouteElement({ children }: { children: ReactNode }) {
  return (
    <SiteShell>
      <Suspense fallback={<SiteLoadingScreen message="LOADING" submessage="Bringing the next kinetic surface online." />}>
        {children}
      </Suspense>
    </SiteShell>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <SiteRouteElement>
        <LandingPage />
      </SiteRouteElement>
    ),
  },
  {
    path: "/setup",
    element: (
      <SiteRouteElement>
        <ProfileSetupPage />
      </SiteRouteElement>
    ),
  },
  {
    path: "/dashboard",
    element: (
      <SiteRouteElement>
        <DashboardPage />
      </SiteRouteElement>
    ),
  },
  {
    path: "/auth",
    element: (
      <SiteRouteElement>
        <AuthPage />
      </SiteRouteElement>
    ),
  },
  {
    path: "/create",
    element: (
      <SiteRouteElement>
        <CreateRoomPage />
      </SiteRouteElement>
    ),
  },
  {
    path: "/join",
    element: (
      <AppRouteElement>
        <JoinRoomPage />
      </AppRouteElement>
    ),
  },
  {
    path: "/join/:roomId",
    element: (
      <AppRouteElement>
        <JoinRoomWithIdPage />
      </AppRouteElement>
    ),
  },
  {
    path: "/room/:roomId",
    element: (
      <AppRouteElement>
        <RoomPage />
      </AppRouteElement>
    ),
  },
  {
    path: "/call/:callId",
    element: (
      <AppRouteElement>
        <GroupCallPage />
      </AppRouteElement>
    ),
  },
  {
    path: "*",
    element: (
      <SiteRouteElement>
        <NotFoundPage />
      </SiteRouteElement>
    ),
  },
]);

function initTheme() {
  try {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
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
  <SiteShell>
    <div className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-6 md:py-20">
      <div className="w-full max-w-4xl border-2 border-border bg-background p-6 sm:p-8 md:p-12">
        <p className="site-kicker text-accent">Missing configuration</p>
        <h1 className="mt-4 text-[clamp(2.6rem,11vw,8rem)] font-bold uppercase leading-[0.82] tracking-[-0.08em]">
          Set VITE_CONVEX_URL
        </h1>
        <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg md:text-xl">
          Add VITE_CONVEX_URL to your environment before running the app.
        </p>
        <p className="mt-4 text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground sm:text-sm sm:tracking-[0.18em]">
          Create a .env file or export the variable in your shell.
        </p>
      </div>
    </div>
  </SiteShell>
);

const app = (
  <StrictMode>
    <InstrumentationProvider>
      <AppReady onReady={dismissSplash} />
      {hasConvex && convex ? (
        <ConvexProvider client={convex}>
          <CallProvider>
            <ConvexConnectionBanner />
            <RouterProvider router={router} />
            <SiteToaster />
          </CallProvider>
        </ConvexProvider>
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


