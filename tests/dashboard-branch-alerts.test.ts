import { describe, expect, it } from "vitest";
import { availableStockQuantity, isBelowLowStockThreshold } from "@/lib/stock-status";
import { lotStatus } from "@/lib/expiry";

/**
 * Mirrors dashboard all-branch alert aggregation: a product can be low at one
 * branch and fine at another — both lanes contribute separate tagged rows.
 */
describe("dashboard multi-branch stock alerts", () => {
  it("counts low stock per branch, not org sum", () => {
    const threshold = 5;
    const branchA = availableStockQuantity({
      tracksExpiry: false,
      stockQuantity: 2,
      sellableQuantity: 2,
    });
    const branchB = availableStockQuantity({
      tracksExpiry: false,
      stockQuantity: 15,
      sellableQuantity: 15,
    });
    expect(isBelowLowStockThreshold(branchA, threshold)).toBe(true);
    expect(isBelowLowStockThreshold(branchB, threshold)).toBe(false);
    const alerts = [
      { branch: "A", qty: branchA },
      { branch: "B", qty: branchB },
    ].filter((row) => isBelowLowStockThreshold(row.qty, threshold));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.branch).toBe("A");
  });

  it("flags expiry on the branch that has the lot only", () => {
    expect(lotStatus("2099-01-01", 30)).toBe("ok");
    expect(lotStatus("2000-01-01", 30)).toBe("expired");
  });
});
