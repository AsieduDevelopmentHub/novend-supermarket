#!/usr/bin/env node
/**
 * Copy Next.js standalone output into apps/desktop/resources/app-server
 * for the Electron till shell (loopback server — no hosted URL).
 *
 * Prerequisites: `pnpm build` (produces `.next/standalone`).
 *
 * Windows note: `fs.cpSync` follows junctions and breaks pnpm's layout, so Next
 * cannot resolve `@swc/helpers` inside the packaged app. We (1) prefer robocopy
 * `/SL` to preserve links when available, then (2) materialize critical packages
 * into top-level `node_modules` so Electron-as-Node boots even if links are lost.
 */
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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

/** Copy while preserving Windows junctions / symlinks when possible. */
function copyStandaloneTree(src, dest) {
  if (process.platform === "win32") {
    mkdirSync(dest, { recursive: true });
    // /E copy subdirs, /SL copy symlinks as links, /NFL /NDL quiet file/dir lists
    const result = spawnSync(
      "robocopy",
      [src, dest, "/E", "/SL", "/NFL", "/NDL", "/NJH", "/NJS", "/NP"],
      { encoding: "utf8" },
    );
    // robocopy exit codes 0–7 are success / minor extras
    if ((result.status ?? 16) < 8) return;
    console.warn(
      `robocopy /SL failed (code ${result.status}); falling back to fs.cpSync — NODE_PATH heal still applies at runtime.`,
    );
  }
  cpSync(src, dest, { recursive: true, verbatimSymlinks: true });
}

/**
 * Ensure a package exists at node_modules/<name> by copying from the pnpm
 * virtual store (`.pnpm/node_modules/...`).
 */
function materializeFromPnpmStore(serverRoot, packageName) {
  const parts = packageName.split("/");
  const dest = join(serverRoot, "node_modules", ...parts);
  if (existsSync(join(dest, "package.json"))) return false;

  const candidates = [
    join(serverRoot, "node_modules", ".pnpm", "node_modules", ...parts),
  ];
  const pnpmRoot = join(serverRoot, "node_modules", ".pnpm");
  if (existsSync(pnpmRoot)) {
    const needle = packageName.startsWith("@")
      ? packageName.replace("/", "+")
      : packageName;
    for (const entry of readdirSync(pnpmRoot)) {
      if (!entry.startsWith(`${needle}@`) && entry !== needle) continue;
      candidates.push(join(pnpmRoot, entry, "node_modules", ...parts));
    }
  }

  for (const src of candidates) {
    if (!existsSync(join(src, "package.json"))) continue;
    mkdirSync(dirname(dest), { recursive: true });
    try {
      const stat = lstatSync(src);
      if (stat.isSymbolicLink()) {
        symlinkSync(readlinkSync(src), dest, "junction");
      } else {
        cpSync(src, dest, { recursive: true });
      }
      console.log(`Materialized ${packageName} → ${relative(serverRoot, dest)}`);
      return true;
    } catch (error) {
      try {
        cpSync(src, dest, { recursive: true });
        console.log(`Materialized ${packageName} → ${relative(serverRoot, dest)}`);
        return true;
      } catch (copyError) {
        console.warn(`Could not materialize ${packageName}:`, copyError);
      }
    }
  }
  return false;
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
copyStandaloneTree(standaloneRoot, outDir);

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

// Critical Next 16 runtime deps that break when pnpm junctions are flattened.
for (const pkg of ["@swc/helpers", "styled-jsx", "client-only", "sharp"]) {
  materializeFromPnpmStore(serverDir, pkg);
}

const relativePath = serverDir.slice(outDir.length).replace(/\\/g, "/") || "/";
console.log(
  `Prepared Electron app-server (server.js at app-server${relativePath === "/" ? "" : relativePath})`,
);
