#!/usr/bin/env node
/**
 * Stamp Millie's ICO + version strings onto the packaged Windows exe.
 *
 * electron-builder's `signAndEditExecutable: false` (needed on some Windows
 * machines without symlink privilege) skips rcedit, leaving the default
 * Electron icon on shortcuts. Run this after `electron-builder --win`.
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const desktopRoot = join(root, "apps/desktop");
const icoPath = join(desktopRoot, "build/icon.ico");
const exePath = join(desktopRoot, "release/win-unpacked/MilliesSupermarket.exe");

if (!existsSync(exePath)) {
  console.error(`Missing packaged exe: ${exePath}`);
  process.exit(1);
}
if (!existsSync(icoPath)) {
  console.error(`Missing icon: ${icoPath} — run generate-desktop-icons first`);
  process.exit(1);
}

const requireFromDesktop = createRequire(join(desktopRoot, "package.json"));
/** @type {{ rcedit: (exe: string, options: Record<string, unknown>) => Promise<void> }} */
let rceditMod;
try {
  rceditMod = requireFromDesktop("rcedit");
} catch {
  console.error("Install rcedit in apps/desktop to stamp the Windows icon.");
  process.exit(1);
}

const pkg = requireFromDesktop("./package.json");
const version = typeof pkg.version === "string" ? pkg.version : "1.0.0";
const rcedit = rceditMod.rcedit ?? rceditMod.default ?? rceditMod;
await rcedit(exePath, {
  icon: icoPath,
  "version-string": {
    FileDescription: "Millie's Supermarket",
    ProductName: "Millie's Supermarket",
    CompanyName: "Asiedu Development Hub",
    LegalCopyright: "Asiedu Development Hub",
    OriginalFilename: "MilliesSupermarket.exe",
  },
  "product-version": version,
  "file-version": version,
});
console.log(`Stamped icon + version onto ${exePath}`);
