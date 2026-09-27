import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { landingCopy } from "@/features/marketing/content";

describe("marketing product demo", () => {
  it("publishes overview and guided chapters with public media files", () => {
    const published = landingCopy.demo.chapters.filter((chapter) => chapter.published);
    expect(published.map((chapter) => chapter.id)).toEqual(["overview", "guided"]);

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
    expect(landingCopy.nav.demo.href).toBe("/#demo");
    expect(landingCopy.hero.secondaryHref).toBe("/#demo");
    expect(landingCopy.footer.product.some((item) => item.href === "/#demo")).toBe(true);
  });
});
