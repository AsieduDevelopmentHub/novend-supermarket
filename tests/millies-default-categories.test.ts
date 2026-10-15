import { describe, expect, it } from "vitest";
import { DEFAULT_SUPERMARKET_CATEGORIES } from "@/lib/offline/millies-default-categories";

describe("millies default supermarket categories", () => {
  it("includes common aisle groups", () => {
    expect(DEFAULT_SUPERMARKET_CATEGORIES).toContain("Fresh produce");
    expect(DEFAULT_SUPERMARKET_CATEGORIES).toContain("Beverages");
    expect(DEFAULT_SUPERMARKET_CATEGORIES).toContain("Dairy & eggs");
    expect(DEFAULT_SUPERMARKET_CATEGORIES).toContain("Household & cleaning");
    expect(DEFAULT_SUPERMARKET_CATEGORIES.length).toBeGreaterThanOrEqual(15);
  });

  it("has unique names", () => {
    const set = new Set(DEFAULT_SUPERMARKET_CATEGORIES);
    expect(set.size).toBe(DEFAULT_SUPERMARKET_CATEGORIES.length);
  });
});
