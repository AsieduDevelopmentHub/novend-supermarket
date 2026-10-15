#!/usr/bin/env node
/**
 * Sync public branding + desktop/web icons from the Millie's master mark.
 *
 * Source of truth: docs/design/branding/MilliesSupermarket.png
 * (falls back to milliesmart.png if the new master is missing)
 *   node scripts/sync-branding-from-master.mjs
 *
 * Then regenerate Windows ICO + mobile launchers:
 *   node scripts/generate-desktop-icons.mjs
 *   node scripts/generate-mobile-icons.mjs
 */
import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const preferredMaster = join(root, "docs/design/branding/MilliesSupermarket.png");
const legacyMaster = join(root, "docs/design/branding/milliesmart.png");
const masterPath = existsSync(preferredMaster) ? preferredMaster : legacyMaster;
if (!existsSync(masterPath)) {
  console.error(`Missing master brandmark: ${preferredMaster}`);
  process.exit(1);
}

const requireFromRoot = createRequire(join(root, "package.json"));
/** @type {typeof import("sharp")} */
const sharp = requireFromRoot("sharp");

/** Millie's wordmark navy (#012561). */
const NAVY = { r: 1, g: 37, b: 97, alpha: 1 };
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

/** Trim near-white / transparent padding, keep a little breathing room. */
async function trimmedMark() {
  const trimmed = await sharp(masterPath)
    .trim({ threshold: 12 })
    .ensureAlpha()
    .png()
    .toBuffer();
  const meta = await sharp(trimmed).metadata();
  const pad = Math.round(Math.max(meta.width ?? 0, meta.height ?? 0) * 0.04);
  return sharp(trimmed)
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: CLEAR,
    })
    .png()
    .toBuffer();
}

async function writeSquarePng(input, outPath, size, background = CLEAR, padRatio = 0.08) {
  mkdirSync(dirname(outPath), { recursive: true });
  const meta = await sharp(input).metadata();
  const iw = meta.width ?? size;
  const ih = meta.height ?? size;
  const inner = Math.round(size * (1 - padRatio * 2));
  const logo = await sharp(input)
    .resize(inner, inner, { fit: "contain", background: CLEAR })
    .png()
    .toBuffer();
  const opaque =
    background.alpha === 1 ||
    (background.alpha === undefined &&
      (background.r !== 0 || background.g !== 0 || background.b !== 0));
  if (opaque) {
    await sharp({
      create: { width: size, height: size, channels: 4, background },
    })
      .composite([{ input: logo, gravity: "centre" }])
      .png()
      .toFile(outPath);
  } else {
    await sharp({
      create: { width: size, height: size, channels: 4, background: CLEAR },
    })
      .composite([{ input: logo, gravity: "centre" }])
      .png()
      .toFile(outPath);
  }
  void iw;
  void ih;
  console.log(`Wrote ${outPath}`);
}

async function writeContainPng(input, outPath, width, height, background = CLEAR) {
  mkdirSync(dirname(outPath), { recursive: true });
  const logo = await sharp(input)
    .resize(width, height, { fit: "contain", background: CLEAR })
    .png()
    .toBuffer();
  await sharp({
    create: { width, height, channels: 4, background },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(outPath);
  console.log(`Wrote ${outPath}`);
}

async function writeLoginHero(markBuf, outPath) {
  const width = 720;
  const height = 1280;
  const markSize = 320;
  const mark = await sharp(markBuf)
    .resize(markSize, markSize, { fit: "contain", background: CLEAR })
    .png()
    .toBuffer();
  await sharp({
    create: { width, height, channels: 4, background: NAVY },
  })
    .composite([{ input: mark, left: Math.round((width - markSize) / 2), top: 200 }])
    .png()
    .toFile(outPath);
  console.log(`Wrote ${outPath}`);
}

const mark = await trimmedMark();

// Web / PWA / Electron square icons
await writeSquarePng(mark, join(root, "public/branding/brandmark.png"), 512, WHITE, 0.06);
await writeSquarePng(mark, join(root, "apps/desktop/build/icon.png"), 512, NAVY, 0.1);
await writeSquarePng(mark, join(root, "public/icons/icon-512.png"), 512, NAVY, 0.1);
await writeSquarePng(mark, join(root, "public/icons/icon-192.png"), 192, NAVY, 0.1);
await writeSquarePng(mark, join(root, "public/favicon.png"), 64, WHITE, 0.08);
await writeSquarePng(mark, join(root, "public/icon.png"), 512, NAVY, 0.1);

// Wordmark lockups — Millie's master already includes typography
await writeContainPng(mark, join(root, "public/branding/logo_horizontal.png"), 640, 220, CLEAR);
await writeContainPng(mark, join(root, "public/branding/logo_horizontal_light.png"), 640, 220, CLEAR);
await writeContainPng(mark, join(root, "public/branding/logo_vertical.png"), 360, 360, CLEAR);
await writeLoginHero(mark, join(root, "public/branding/login_hero.png"));

// Keep docs master and public brandmark aligned for designers
copyFileSync(masterPath, join(root, "docs/design/branding/logo_generated.png"));

console.log(`Branding synced from ${masterPath}`);
