import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function readFileIfExists(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, "utf8");
}

function parseSimpleEnv(content) {
  const out = {};
  if (!content) return out;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

function deploymentSlugFromUrl(value) {
  if (!value) return null;
  try {
    const host = new URL(value).hostname;
    return host.split(".")[0] || null;
  } catch {
    return null;
  }
}

const failures = [];
const warnings = [];

const dotEnv = readFileIfExists(".env");
const dotEnvLocal = readFileIfExists(".env.local");
const envExample = readFileIfExists(".env.example");
const convexDev = readFileIfExists(".env.convex.dev");
const convexProd = readFileIfExists(".env.convex.prod");

const envLocal = parseSimpleEnv(dotEnvLocal);
const example = parseSimpleEnv(envExample);
const devTarget = parseSimpleEnv(convexDev);
const prodTarget = parseSimpleEnv(convexProd);

if ((dotEnv && /(^|\n)\s*JWT_PRIVATE_KEY\s*=/.test(dotEnv)) || (dotEnvLocal && /(^|\n)\s*JWT_PRIVATE_KEY\s*=/.test(dotEnvLocal))) {
  failures.push("Remove JWT_PRIVATE_KEY from .env/.env.local. This app uses room-scoped anonymous sessions (no frontend JWT key).");
}

if (!example.VITE_CONVEX_URL || !example.VITE_CONVEX_SITE_URL) {
  failures.push(".env.example must define both VITE_CONVEX_URL and VITE_CONVEX_SITE_URL placeholders.");
}

if (!devTarget.CONVEX_DEPLOYMENT?.startsWith("dev:")) {
  failures.push(".env.convex.dev must contain CONVEX_DEPLOYMENT=dev:<deployment-slug>.");
}

if (!prodTarget.CONVEX_DEPLOYMENT?.startsWith("prod:")) {
  failures.push(".env.convex.prod must contain CONVEX_DEPLOYMENT=prod:<deployment-slug>.");
}

if (envLocal?.VITE_CONVEX_URL && envLocal?.VITE_CONVEX_SITE_URL) {
  const cloudSlug = deploymentSlugFromUrl(envLocal.VITE_CONVEX_URL);
  const siteSlug = deploymentSlugFromUrl(envLocal.VITE_CONVEX_SITE_URL);
  if (cloudSlug && siteSlug && cloudSlug !== siteSlug) {
    failures.push(".env.local VITE_CONVEX_URL and VITE_CONVEX_SITE_URL point to different deployments.");
  }
}

if (!envLocal?.VITE_CONVEX_URL || !envLocal?.VITE_CONVEX_SITE_URL) {
  warnings.push(".env.local is missing VITE_CONVEX_URL or VITE_CONVEX_SITE_URL.");
}

console.log("Convex Deployment Doctor\n");
if (failures.length === 0) {
  console.log("PASS: no blocking configuration issues found.");
} else {
  console.log("FAIL: blocking issues found:");
  for (const msg of failures) console.log(` - ${msg}`);
}

if (warnings.length > 0) {
  console.log("\nWarnings:");
  for (const msg of warnings) console.log(` - ${msg}`);
}

console.log("\nRelease checklist:");
console.log(" 1) npx convex dev --env-file .env.convex.dev   # authenticate CLI once");
console.log(" 2) npm run convex:push:dev");
console.log(" 3) npm run convex:deploy:prod");
console.log(" 4) Ensure VITE_CONVEX_URL and VITE_CONVEX_SITE_URL target the same deployment slug");

process.exit(failures.length ? 1 : 0);
