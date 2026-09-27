import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { landingCopy } from "@/features/marketing/content";
import { isMarketingPath } from "@/lib/marketing-routes";

describe("marketing product demo", () => {
  it("publishes complete training and guided chapters with public media files", () => {
    const published = landingCopy.demo.chapters.filter((chapter) => chapter.published);
    expect(published.map((chapter) => chapter.id)).toEqual(["overview", "guided"]);
    expect(published[0]?.src).toBe("/marketing/demo/complete-training.mp4");

    for (const chapter of published) {
      expect(chapter.src).toMatch(/^\/marketing\/demo\/.+\.mp4$/);
      const diskPath = resolve(process.cwd(), "public", chapter.src!.replace(/^\//, ""));
      expect(existsSync(diskPath), `missing ${chapter.src}`).toBe(true);
    }
  });

  it("keeps upcoming activity chapters ready to flip on", () => {
    const upcoming = landingCopy.demo.chapters.filter((chapter) => !chapter.published);
    expect(upcoming.map((chapter) => chapter.id)).toEqual([
      "login",
      "signup",
      "onboarding",
      "checkout",
      "inventory",
      "offline",
    ]);
    for (const chapter of upcoming) {
      expect(chapter.src).toBeNull();
    }
  });

  it("exposes demo CTAs and nav entry", () => {
    expect(landingCopy.demo.primaryCta.length).toBeGreaterThan(0);
    expect(landingCopy.demo.secondaryHref).toBe("/contact");
    expect(landingCopy.demo.seriesHref).toBe("/demo#full");
    expect(landingCopy.nav.demo.href).toBe("/demo#full");
    expect(landingCopy.hero.secondaryHref).toBe("/demo#full");
    expect(landingCopy.footer.product.some((item) => item.href === "/demo#full")).toBe(true);
  });
});

describe("marketing training series demo page", () => {
  it("defaults to the merged complete training as the main video", () => {
    expect(landingCopy.demoPage.full.id).toBe("full");
    expect(landingCopy.demoPage.full.src).toBe("/marketing/demo/complete-training.mp4");
    const fullPath = resolve(
      process.cwd(),
      "public",
      landingCopy.demoPage.full.src.replace(/^\//, ""),
    );
    expect(existsSync(fullPath), `missing ${landingCopy.demoPage.full.src}`).toBe(true);
  });

  it("publishes fourteen per-action episodes with media on disk", () => {
    expect(landingCopy.demoPage.episodes).toHaveLength(14);
    expect(landingCopy.demoPage.episodes.map((episode) => episode.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ]);

    expect(landingCopy.demoPage.poster).toBe("/branding/brandmark.png");
    const posterPath = resolve(
      process.cwd(),
      "public",
      landingCopy.demoPage.poster.replace(/^\//, ""),
    );
    expect(existsSync(posterPath), `missing ${landingCopy.demoPage.poster}`).toBe(true);

    for (const episode of landingCopy.demoPage.episodes) {
      expect(episode.src).toMatch(/^\/marketing\/demo\/training\/.+\.mp4$/);
      const diskPath = resolve(process.cwd(), "public", episode.src.replace(/^\//, ""));
      expect(existsSync(diskPath), `missing ${episode.src}`).toBe(true);
    }
  });

  it("treats /demo as a public marketing route", () => {
    expect(isMarketingPath("/demo")).toBe(true);
    expect(isMarketingPath("/demo#sales")).toBe(true);
    expect(isMarketingPath("/demo#full")).toBe(true);
  });
});

describe("demo page hash defaults", () => {
  it("resolves empty and unknown hashes to the full training video", async () => {
    const { parsePlayableHash } = await import(
      "@/features/marketing/components/demo-page-view"
    );
    expect(parsePlayableHash("")).toBe("full");
    expect(parsePlayableHash("#")).toBe("full");
    expect(parsePlayableHash("#demo")).toBe("full");
    expect(parsePlayableHash("#full")).toBe("full");
    expect(parsePlayableHash("#demo-guided")).toBe("full");
    expect(parsePlayableHash("#sales")).toBe("sales");
    expect(parsePlayableHash("#dashboard")).toBe("dashboard");
    expect(parsePlayableHash("#episode-inventory")).toBe("inventory");
  });
});
