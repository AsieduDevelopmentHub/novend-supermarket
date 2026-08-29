import { describe, expect, it } from "vitest";
import {
  getTourDefinition,
  resolveStepAnchor,
  tourForPath,
  toursForAccess,
} from "@/features/tours/tour-registry";

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

  it("resolves the first matching responsive anchor", () => {
    const root = {
      querySelector(selector: string) {
        return selector === '[data-tour="mobile-bottom-navigation"]' ? {} : null;
      },
    } as unknown as ParentNode;
    expect(
      resolveStepAnchor(
        {
          id: "navigation",
          anchors: [
            '[data-tour="desktop-navigation"]',
            '[data-tour="mobile-bottom-navigation"]',
          ],
          title: "Workspace",
          description: "Move between tools.",
        },
        root,
      ),
    ).toBe('[data-tour="mobile-bottom-navigation"]');
  });
});
