#!/usr/bin/env node
/**
 * Sync public branding + desktop/web icons from the master Novend mark.
 *
 * Source of truth: docs/design/branding/novend.png (clean, smooth N).
 *   node scripts/sync-branding-from-master.mjs
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const masterPath = join(root, "docs/design/branding/novend.png");
if (!existsSync(masterPath)) {
  console.error(`Missing master brandmark: ${masterPath}`);
  process.exit(1);
}

const requireFromRoot = createRequire(join(root, "package.json"));
/** @type {typeof import("sharp")} */
const sharp = requireFromRoot("sharp");

const NAVY = { r: 11, g: 31, b: 51, alpha: 1 }; // #0B1F33
const WORDMARK_NAVY = "#0B1F33";
const WORDMARK_LIGHT = "#FFFFFF";
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

/** Trim near-transparent padding, keep a little breathing room. */
async function trimmedMark() {
  const trimmed = await sharp(masterPath).trim({ threshold: 8 }).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const pad = Math.round(Math.max(meta.width ?? 0, meta.height ?? 0) * 0.06);
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

async function writeSquarePng(input, outPath, size, background = CLEAR) {
  mkdirSync(dirname(outPath), { recursive: true });
  const opaque =
    background.alpha === 1 ||
    (background.alpha === undefined &&
      (background.r !== 0 || background.g !== 0 || background.b !== 0));
  if (opaque) {
    const logo = await sharp(input)
      .resize(size, size, { fit: "contain", background: CLEAR })
      .png()
      .toBuffer();
    await sharp({
      create: { width: size, height: size, channels: 4, background },
    })
      .composite([{ input: logo, gravity: "centre" }])
      .png()
      .toFile(outPath);
  } else {
    await sharp(input)
      .resize(size, size, { fit: "contain", background })
      .png()
      .toFile(outPath);
  }
  console.log(`Wrote ${outPath}`);
}

function wordmarkSvg(textColor, width, height, markSize, markGap) {
  const textX = markSize + markGap;
  const fontSize = Math.round(markSize * 0.52);
  const textY = Math.round(height * 0.62);
  return Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${textX}" y="${textY}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="${textColor}">Novend</text>
</svg>`,
  );
}

async function writeHorizontal(markBuf, outPath, textColor) {
  const markSize = 120;
  const markGap = 18;
  const width = 470;
  const height = 134;
  const mark = await sharp(markBuf)
    .resize(markSize, markSize, { fit: "contain", background: CLEAR })
    .png()
    .toBuffer();
  const text = await sharp(wordmarkSvg(textColor, width, height, markSize, markGap))
    .png()
    .toBuffer();
  await sharp({
    create: { width, height, channels: 4, background: CLEAR },
  })
    .composite([
      { input: mark, left: 0, top: Math.round((height - markSize) / 2) },
      { input: text, left: 0, top: 0 },
    ])
    .png()
    .toFile(outPath);
  console.log(`Wrote ${outPath}`);
}

async function writeVertical(markBuf, outPath) {
  const size = 292;
  const markSize = 180;
  const mark = await sharp(markBuf)
    .resize(markSize, markSize, { fit: "contain", background: CLEAR })
    .png()
    .toBuffer();
  const fontSize = 42;
  const textSvg = Buffer.from(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <text x="50%" y="${markSize + 52}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="${WORDMARK_LIGHT}">Novend</text>
</svg>`,
  );
  const text = await sharp(textSvg).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: CLEAR },
  })
    .composite([
      { input: mark, left: Math.round((size - markSize) / 2), top: 18 },
      { input: text, left: 0, top: 0 },
    ])
    .png()
    .toFile(outPath);
  console.log(`Wrote ${outPath}`);
}

async function writeLoginHero(markBuf, outPath) {
  // Match previous login_hero proportions (tall panel with mark near top).
  const width = 720;
  const height = 1280;
  const markSize = 220;
  const mark = await sharp(markBuf)
    .resize(markSize, markSize, { fit: "contain", background: CLEAR })
    .png()
    .toBuffer();
  await sharp({
    create: { width, height, channels: 4, background: NAVY },
  })
    .composite([{ input: mark, left: Math.round((width - markSize) / 2), top: 160 }])
    .png()
    .toFile(outPath);
  console.log(`Wrote ${outPath}`);
}

const mark = await trimmedMark();

await writeSquarePng(mark, join(root, "public/branding/brandmark.png"), 512);
await writeSquarePng(mark, join(root, "apps/desktop/build/icon.png"), 512, NAVY);
await writeSquarePng(mark, join(root, "public/icons/icon-512.png"), 512, NAVY);
await writeSquarePng(mark, join(root, "public/icons/icon-192.png"), 192, NAVY);
await writeSquarePng(mark, join(root, "public/favicon.png"), 32, NAVY);

await writeHorizontal(mark, join(root, "public/branding/logo_horizontal.png"), WORDMARK_NAVY);
await writeHorizontal(
  mark,
  join(root, "public/branding/logo_horizontal_light.png"),
  WORDMARK_LIGHT,
);
await writeVertical(mark, join(root, "public/branding/logo_vertical.png"));
await writeLoginHero(mark, join(root, "public/branding/login_hero.png"));

console.log("Branding synced from docs/design/branding/novend.png");
