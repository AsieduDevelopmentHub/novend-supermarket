#!/usr/bin/env node
/**
 * Ensure desktop `build/icon.png` exists, then generate Windows ICO.
 *
 *   node scripts/generate-desktop-icons.mjs
 */
import { createRequire } from "node:module";
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const desktopRoot = join(root, "apps/desktop");
const requireFromDesktop = createRequire(join(desktopRoot, "package.json"));
const pngPath = join(desktopRoot, "build/icon.png");
const icoPath = join(desktopRoot, "build/icon.ico");
const fallbackPng = join(root, "public/icons/icon-512.png");

if (!existsSync(pngPath)) {
  if (!existsSync(fallbackPng)) {
    throw new Error(`Missing desktop icon at ${pngPath} and fallback ${fallbackPng}`);
  }
  copyFileSync(fallbackPng, pngPath);
  console.log(`Restored ${pngPath} from ${fallbackPng}`);
}

const pngToIco = requireFromDesktop("png-to-ico");
const icoBuffer = await pngToIco(pngPath);
writeFileSync(icoPath, icoBuffer);
console.log(`Wrote ${icoPath}`);
