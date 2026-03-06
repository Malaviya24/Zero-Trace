import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

function getNodeModulePackageName(id: string) {
  const normalizedId = id.replaceAll("\\", "/");
  const modulePath = normalizedId.split("node_modules/")[1];
  if (!modulePath) return null;
  const segments = modulePath.split("/");
  if (segments[0].startsWith("@")) {
    return `${segments[0]}/${segments[1]}`;
  }
  return segments[0];
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          const packageName = getNodeModulePackageName(id);
          if (!packageName) return "vendor";

          if (
            packageName === "react" ||
            packageName === "react-dom" ||
            packageName === "react-router" ||
            packageName === "scheduler"
          ) {
            return "framework";
          }

          if (packageName.startsWith("@radix-ui/")) {
            return "radix";
          }

          if (
            packageName === "framer-motion" ||
            packageName.startsWith("motion-")
          ) {
            return "motion";
          }

          if (
            packageName === "convex" ||
            packageName.startsWith("@convex-dev/")
          ) {
            return "convex";
          }

          if (
            packageName === "html5-qrcode" ||
            packageName === "qrcode" ||
            packageName === "@zumer/snapdom"
          ) {
            return "scanner";
          }

          if (
            packageName === "lucide-react" ||
            packageName === "sonner" ||
            packageName === "class-variance-authority" ||
            packageName === "clsx" ||
            packageName === "tailwind-merge" ||
            packageName === "cmdk" ||
            packageName === "vaul"
          ) {
            return "ui";
          }

          if (
            packageName === "three" ||
            packageName.startsWith("@react-three/") ||
            packageName === "recharts"
          ) {
            return "viz";
          }

          return "vendor";
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
