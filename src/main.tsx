import { Toaster } from "@/components/ui/sonner";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { InstrumentationProvider } from "@/instrumentation.tsx";
import AuthPage from "@/pages/Auth.tsx";
import CreateRoomPage from "@/pages/CreateRoomPage.tsx";
import JoinRoomPage from "@/pages/JoinRoomPage.tsx";
import RoomPage from "@/pages/RoomPage.tsx";
import JoinRoomWithIdPage from "@/pages/JoinRoomWithIdPage.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, useLocation } from "react-router";
import "./index.css";
import Landing from "./pages/Landing.tsx";
import NotFound from "./pages/NotFound.tsx";
import "./types/global.d.ts";
import GroupCallPage from "./pages/GroupCallPage.tsx";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const hasConvex = typeof convexUrl === "string" && convexUrl.length > 0;
const convex = hasConvex ? new ConvexReactClient(convexUrl) : null;

const router = createBrowserRouter([
  {
    path: "/",
    element: <Landing />,
  },
  {
    path: "/auth",
    element: <AuthPage />,
  },
  {
    path: "/create",
    element: <CreateRoomPage />,
  },
  {
    path: "/join",
    element: <JoinRoomPage />,
  },
  {
    path: "/join/:roomId",
    element: <JoinRoomWithIdPage />,
  },
  {
    path: "/room/:roomId",
    element: <RoomPage />,
  },
  {
    path: "/call/:callId",
    element: <GroupCallPage />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

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
    <VlyToolbar />
    <InstrumentationProvider>
      <AppReady onReady={dismissSplash} />
      {hasConvex && convex ? (
        <ConvexAuthProvider client={convex}>
          <RouterProvider router={router} />
          <Toaster />
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
