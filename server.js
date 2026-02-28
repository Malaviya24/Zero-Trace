import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { readFileSync } from "fs";

const app = new Hono();

app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  c.header(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.metered.ca https://*.expressturn.com stun: turn:",
      "media-src 'self' blob:",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );
});

app.use(
  "/*",
  serveStatic({
    root: "./dist",
    onNotFound: () => {},
  })
);

const indexHtml = readFileSync("./dist/index.html", "utf-8");

app.get("*", (c) => {
  c.header("Cache-Control", "no-cache");
  return c.html(indexHtml);
});

const port = 5000;
console.log(`Server running on port ${port}`);
serve({ fetch: app.fetch, port });
