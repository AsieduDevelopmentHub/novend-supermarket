#!/usr/bin/env node
/**
 * Generate Android launcher + splash assets from the Novend brandmark.
 *
 * Source: apps/desktop/build/icon.png (same master as Electron).
 *   node scripts/generate-mobile-icons.mjs
 */
import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mobileRoot = join(root, "apps/mobile");
const androidRes = join(mobileRoot, "android/app/src/main/res");
const resourcesDir = join(mobileRoot, "resources");
const sourceCandidates = [
  join(root, "apps/desktop/build/icon.png"),
  join(root, "public/branding/brandmark.png"),
];

const source = sourceCandidates.find((path) => existsSync(path));
if (!source) {
  console.error("No Novend icon source found (desktop build/icon.png or public/branding/brandmark.png)");
  process.exit(1);
}

const requireFromRoot = createRequire(join(root, "package.json"));
/** @type {typeof import("sharp")} */
let sharp;
try {
  sharp = requireFromRoot("sharp");
} catch {
  console.error('Missing dependency "sharp". Run: pnpm add -D sharp -w');
  process.exit(1);
}

const NAVY = { r: 11, g: 31, b: 51, alpha: 1 }; // #0B1F33

mkdirSync(resourcesDir, { recursive: true });

const masterPath = join(resourcesDir, "icon.png");
await sharp(source)
  .resize(1024, 1024, { fit: "contain", background: NAVY })
  .png()
  .toFile(masterPath);
copyFileSync(masterPath, join(resourcesDir, "icon-only.png"));

/** Launcher bitmap sizes (dp × density). */
const LAUNCHER = [
  ["mipmap-mdpi", 48],
  ["mipmap-hdpi", 72],
  ["mipmap-xhdpi", 96],
  ["mipmap-xxhdpi", 144],
  ["mipmap-xxxhdpi", 192],
];

/** Adaptive foreground: full bleed canvas with logo inset for safe zone (~66%). */
const FOREGROUND = [
  ["mipmap-mdpi", 108],
  ["mipmap-hdpi", 162],
  ["mipmap-xhdpi", 216],
  ["mipmap-xxhdpi", 324],
  ["mipmap-xxxhdpi", 432],
];

async function writeLauncher(dir, size) {
  const outDir = join(androidRes, dir);
  mkdirSync(outDir, { recursive: true });
  const buf = await sharp(masterPath)
    .resize(size, size, { fit: "cover" })
    .png()
    .toBuffer();
  writeFileSync(join(outDir, "ic_launcher.png"), buf);
  writeFileSync(join(outDir, "ic_launcher_round.png"), buf);
}

async function writeForeground(dir, size) {
  const outDir = join(androidRes, dir);
  mkdirSync(outDir, { recursive: true });
  const inset = Math.round(size * 0.66);
  const logo = await sharp(masterPath)
    .resize(inset, inset, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(join(outDir, "ic_launcher_foreground.png"));
}

for (const [dir, size] of LAUNCHER) {
  await writeLauncher(dir, size);
}
for (const [dir, size] of FOREGROUND) {
  await writeForeground(dir, size);
}

writeFileSync(
  join(androidRes, "values/ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0B1F33</color>
</resources>
`,
);

writeFileSync(
  join(androidRes, "drawable/ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#0B1F33" />
</shape>
`,
);

/** Portrait/landscape splash PNGs — navy + centered brandmark. */
const SPLASH = [
  ["drawable", 480, 800],
  ["drawable-port-mdpi", 320, 480],
  ["drawable-port-hdpi", 480, 800],
  ["drawable-port-xhdpi", 720, 1280],
  ["drawable-port-xxhdpi", 1080, 1920],
  ["drawable-port-xxxhdpi", 1440, 2560],
  ["drawable-land-mdpi", 480, 320],
  ["drawable-land-hdpi", 800, 480],
  ["drawable-land-xhdpi", 1280, 720],
  ["drawable-land-xxhdpi", 1920, 1080],
  ["drawable-land-xxxhdpi", 2560, 1440],
];

for (const [dir, width, height] of SPLASH) {
  const outDir = join(androidRes, dir);
  mkdirSync(outDir, { recursive: true });
  const logoSize = Math.round(Math.min(width, height) * 0.28);
  const logo = await sharp(masterPath)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: NAVY,
    },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(join(outDir, "splash.png"));
}

console.log(`Wrote Novend mobile icons + splash from ${source}`);
