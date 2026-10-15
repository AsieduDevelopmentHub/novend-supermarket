#!/usr/bin/env node
/**
 * Copy Next.js standalone output into apps/desktop/resources/app-server
 * for the Electron till shell (loopback server — no hosted URL).
 *
 * Prerequisites: `pnpm build` (produces `.next/standalone`).
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const standaloneRoot = join(root, ".next", "standalone");
const staticDir = join(root, ".next", "static");
const publicDir = join(root, "public");
const outDir = join(root, "apps", "desktop", "resources", "app-server");

function findServerDir(dir, depth = 0) {
  if (depth > 4) return null;
  if (existsSync(join(dir, "server.js"))) return dir;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }
  for (const name of entries) {
    if (name === "node_modules") continue;
    const child = join(dir, name);
    try {
      if (!statSync(child).isDirectory()) continue;
    } catch {
      continue;
    }
    const found = findServerDir(child, depth + 1);
    if (found) return found;
  }
  return null;
}

if (!existsSync(standaloneRoot)) {
  console.error(
    "Missing .next/standalone — run `pnpm build` first (next.config output: standalone).",
  );
  process.exit(1);
}
if (!existsSync(staticDir)) {
  console.error("Missing .next/static — run `pnpm build` first.");
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(standaloneRoot, outDir, { recursive: true });

const serverDir = findServerDir(outDir);
if (!serverDir) {
  console.error("Could not find server.js under apps/desktop/resources/app-server");
  process.exit(1);
}

mkdirSync(join(serverDir, ".next"), { recursive: true });
cpSync(staticDir, join(serverDir, ".next", "static"), { recursive: true });
if (existsSync(publicDir)) {
  cpSync(publicDir, join(serverDir, "public"), { recursive: true });
}

const relative = serverDir.slice(outDir.length).replace(/\\/g, "/") || "/";
console.log(`Prepared Electron app-server (server.js at app-server${relative === "/" ? "" : relative})`);
