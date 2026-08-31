/**
 * Capture public marketing pages for copy/layout review.
 * Usage: pnpm exec playwright install chromium && pnpm screenshots:public
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";

const origin = process.env.PUBLIC_ORIGIN ?? "http://localhost:3000";
const outDir = fileURLToPath(new URL("../tmp/public-screenshots/", import.meta.url));
mkdirSync(outDir, { recursive: true });

const pages = [
  { path: "/", name: "landing" },
  { path: "/download", name: "download" },
  { path: "/docs", name: "docs" },
  { path: "/docs/help", name: "help" },
  { path: "/docs/releases", name: "releases" },
  { path: "/privacy", name: "privacy" },
  { path: "/terms", name: "terms" },
];

const clips = [
  { path: "/", locator: "#desktop", name: "landing-apps" },
  { path: "/", locator: "#faq", name: "landing-faq" },
  { path: "/", locator: "#industries", name: "landing-industries" },
  { path: "/download", locator: "#mobile", name: "download-mobile-section" },
];

const loaders = [
  "Checking for the latest version",
  "Loading mobile downloads",
  "Loading release notes",
];

const browser = await chromium.launch({ headless: true });

async function settle(page) {
  for (const text of loaders) {
    const loader = page.getByText(text);
    if ((await loader.count()) > 0) {
      await loader.first().waitFor({ state: "hidden", timeout: 12_000 }).catch(() => {});
    }
  }
  await page.waitForTimeout(600);
}

async function capture(viewport, suffix) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(45_000);
  for (const item of pages) {
    await page.goto(`${origin}${item.path}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    const file = path.join(outDir, `${item.name}-${suffix}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`wrote ${file}`);
  }
  if (suffix === "desktop") {
    for (const clip of clips) {
      await page.goto(`${origin}${clip.path}`, { waitUntil: "domcontentloaded" });
      await settle(page);
      const target = page.locator(clip.locator);
      await target.scrollIntoViewIfNeeded();
      const file = path.join(outDir, `${clip.name}.png`);
      await target.screenshot({ path: file });
      console.log(`wrote ${file}`);
    }
  }
  await page.close();
}

await capture({ width: 1440, height: 900 }, "desktop");
await capture({ width: 390, height: 844 }, "mobile");
await browser.close();
