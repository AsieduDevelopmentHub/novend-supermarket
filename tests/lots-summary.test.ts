import { describe, expect, it } from "vitest";
import { summarizeLots } from "@/convex/shared/lots";

describe("summarizeLots expiringQuantity", () => {
  const today = "2026-09-25";

  it("counts only the FEFO alert-window batch as expiringQuantity", () => {
    const summary = summarizeLots(
      [
        { quantity: 10, expiryDate: "2026-10-01" }, // within 30-day alert
        { quantity: 90, expiryDate: "2027-06-01" }, // still fine
        { quantity: 5, expiryDate: "2026-01-01" }, // already expired
      ],
      30,
      today,
    );
    expect(summary.expiredQuantity).toBe(5);
    expect(summary.sellableQuantity).toBe(100);
    expect(summary.expiringQuantity).toBe(10);
    expect(summary.nearestSellableExpiry).toBe("2026-10-01");
  });

  it("respects a shorter admin alert window", () => {
    const summary = summarizeLots(
      [
        { quantity: 8, expiryDate: "2026-10-20" }, // 25 days out
        { quantity: 12, expiryDate: "2026-10-01" }, // 6 days out
      ],
      7,
      today,
    );
    expect(summary.expiringQuantity).toBe(12);
    expect(summary.sellableQuantity).toBe(20);
  });
});
