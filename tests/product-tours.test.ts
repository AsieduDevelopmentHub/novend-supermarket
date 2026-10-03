import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getTourDefinition,
  hasTourProgress,
  onboardingQueue,
  queryTourable,
  resolveStepAnchor,
  tourForPath,
  toursForAccess,
} from "@/features/tours/tour-registry";
import { mergeTourProgress, parseTourProgress } from "@/lib/offline/tour-progress-cache";

describe("product tour access", () => {
  it("never exposes management tours to cashiers", () => {
    const ids = toursForAccess("cashier", false).map((tour) => tour.id);
    expect(ids).toContain("sales");
    expect(ids).toContain("settings");
    expect(ids).not.toContain("products");
    expect(ids).not.toContain("inventory");
    expect(ids).not.toContain("users");
    expect(ids).not.toContain("platform");
  });

  it("provides broad operational tours to managers", () => {
    const ids = toursForAccess("manager", false).map((tour) => tour.id);
    expect(ids).toEqual(
      expect.arrayContaining(["shell", "sales", "products", "inventory", "reports", "users"]),
    );
  });

  it("isolates the platform tour to platform admins", () => {
    expect(toursForAccess(null, true).map((tour) => tour.id)).toEqual(["platform"]);
    expect(toursForAccess("administrator", false).map((tour) => tour.id)).not.toContain("platform");
  });

  it("resolves contextual tours by route", () => {
    expect(tourForPath("/sales", "cashier", false)?.id).toBe("sales");
    expect(tourForPath("/users", "cashier", false)).toBeUndefined();
    expect(tourForPath("/platform/analytics", null, true)?.id).toBe("platform");
  });

  it("keeps every tour versioned", () => {
    expect(getTourDefinition("shell")?.version).toBeGreaterThan(0);
  });

  it("walks cashiers through sales and settings after the shell", () => {
    expect(onboardingQueue("cashier", false)).toEqual(["shell", "sales", "settings"]);
  });

  it("walks administrators through every operational page", () => {
    expect(onboardingQueue("administrator", false)).toEqual([
      "shell",
      "sales",
      "products",
      "inventory",
      "reports",
      "users",
      "settings",
    ]);
  });

  it("keeps platform-only Super Admins on the platform tour", () => {
    expect(onboardingQueue(null, true)).toEqual(["platform"]);
    expect(onboardingQueue("administrator", true)[0]).toBe("shell");
  });

  it("does not treat empty progress as an existing tour record", () => {
    expect(hasTourProgress([], toursForAccess("cashier", false))).toBe(false);
    expect(hasTourProgress([{ tourId: "shell" }], toursForAccess("cashier", false))).toBe(true);
  });

  it("does not auto-start tours on offline shells or before cloud progress loads", () => {
    const source = readFileSync(
      resolve(process.cwd(), "features/tours/tour-provider.tsx"),
      "utf8",
    );
    expect(source).toContain("if (!online) return;");
    expect(source).toContain("typedLiveProgress === undefined");
  });

  it("prefers a later visible navigation anchor over a hidden sidebar", () => {
    const hidden = { hidden: true };
    const visible = { hidden: false };
    const root = {
      querySelector() {
        return hidden;
      },
      querySelectorAll(selector: string) {
        if (selector === '[data-tour="desktop-navigation"]') return [hidden];
        if (selector === '[data-tour="mobile-bottom-navigation"]') return [visible];
        return [];
      },
    };
    expect(
      resolveStepAnchor(
        {
          id: "navigation",
          anchors: ['[data-tour="desktop-navigation"]', '[data-tour="mobile-bottom-navigation"]'],
          title: "Workspace",
          description: "Move between tools.",
        },
        root,
        (node) => !(node as { hidden: boolean }).hidden,
      ),
    ).toBe('[data-tour="mobile-bottom-navigation"]');
  });

  it("resolves the first matching responsive anchor", () => {
    const root = {
      querySelector(selector: string) {
        return selector === '[data-tour="mobile-bottom-navigation"]' ? {} : null;
      },
    };
    expect(
      resolveStepAnchor(
        {
          id: "navigation",
          anchors: ['[data-tour="desktop-navigation"]', '[data-tour="mobile-bottom-navigation"]'],
          title: "Workspace",
          description: "Move between tools.",
        },
        root,
      ),
    ).toBe('[data-tour="mobile-bottom-navigation"]');
  });

  it("skips hidden matches when querying a shared tour attribute", () => {
    const hidden = { hidden: true };
    const visible = { hidden: false };
    const root = {
      querySelector() {
        return hidden;
      },
      querySelectorAll() {
        return [hidden, visible];
      },
    };
    expect(
      queryTourable(
        '[data-tour="sync-status"]',
        root,
        (node) => !(node as { hidden: boolean }).hidden,
      ),
    ).toBe(visible);
  });
});

describe("tour progress merge", () => {
  it("keeps a newer dirty local skip over a stale remote in-progress row", () => {
    const merged = mergeTourProgress(
      [
        {
          tourId: "shell",
          version: 1,
          status: "skipped",
          lastStepId: "navigation",
          updatedAt: 200,
          dirty: true,
        },
      ],
      [
        {
          tourId: "shell",
          version: 1,
          status: "in_progress",
          lastStepId: "welcome",
          updatedAt: 100,
        },
      ],
    );
    expect(merged).toEqual([
      expect.objectContaining({ tourId: "shell", status: "skipped", dirty: true }),
    ]);
  });

  it("prefers remote when local is not dirty", () => {
    const merged = mergeTourProgress(
      [
        {
          tourId: "sales",
          version: 1,
          status: "in_progress",
          lastStepId: "cart",
          updatedAt: 300,
        },
      ],
      [
        {
          tourId: "sales",
          version: 1,
          status: "completed",
          lastStepId: "pay",
          updatedAt: 100,
        },
      ],
    );
    expect(merged[0]?.status).toBe("completed");
    expect(merged[0]?.dirty).toBe(false);
  });

  it("ignores malformed stored JSON", () => {
    expect(parseTourProgress(null)).toEqual([]);
    expect(parseTourProgress([{ tourId: "shell" }])).toEqual([]);
    expect(
      parseTourProgress([
        { tourId: "shell", version: 1, status: "completed", lastStepId: "done", updatedAt: 1 },
      ]),
    ).toHaveLength(1);
  });
});
