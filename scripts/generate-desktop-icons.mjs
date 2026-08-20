#!/usr/bin/env node
/**
 * Generate Windows ICO from the master PNG for crisp taskbar / shortcut icons.
 *
 *   node scripts/generate-desktop-icons.mjs
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const desktopRoot = join(root, "apps/desktop");
const requireFromDesktop = createRequire(join(desktopRoot, "package.json"));
const pngPath = join(desktopRoot, "build/icon.png");
const icoPath = join(desktopRoot, "build/icon.ico");

const pngToIco = requireFromDesktop("png-to-ico");
const icoBuffer = await pngToIco(pngPath);
writeFileSync(icoPath, icoBuffer);
console.log(`Wrote ${icoPath}`);

