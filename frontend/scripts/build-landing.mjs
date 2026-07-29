// Builds dist/ as a static link-landing page (eBay, Whatnot, Instagram)
// instead of running the retired React SaaS app through Vite.
import { mkdirSync, copyFileSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, "..");
const repoRoot = join(frontendRoot, "..");
const dist = join(frontendRoot, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
mkdirSync(join(dist, "links"), { recursive: true });

const landingPage = join(repoRoot, "links", "index.html");
copyFileSync(landingPage, join(dist, "index.html"));
copyFileSync(landingPage, join(dist, "links", "index.html"));

const publicDir = join(frontendRoot, "public");
const assetsToCopy = [
  "favicon.ico",
  "favicon.svg",
  "icon-32x32.png",
  "icon-192x192.png",
  "apple-touch-icon.png",
  "_redirects",
];
for (const asset of assetsToCopy) {
  const src = join(publicDir, asset);
  if (existsSync(src)) copyFileSync(src, join(dist, asset));
}
