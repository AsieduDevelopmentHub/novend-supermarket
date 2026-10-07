import { describe, expect, it } from "vitest";
import {
  buildInventoryValueSeries,
  findInventoryValueDays,
} from "@/convex/shared/inventoryValueSeries";

const start = Date.parse("2026-10-01T00:00:00.000Z");
const end = Date.parse("2026-10-02T23:59:59.999Z");

describe("buildInventoryValueSeries", () => {
  it("prices each day's on-hand quantity at today's prices", () => {
    const series = buildInventoryValueSeries({
      startDate: start,
      endDate: end,
      stock: [
        {
          key: "br:rice",
          quantity: 10,
          costPrice: 2,
          sellingPrice: 3,
        },
      ],
      movements: [
        {
          key: "br:rice",
          quantityChange: 4,
          at: Date.parse("2026-10-02T12:00:00.000Z"),
        },
      ],
    });
    expect(series.opening).toEqual({ cost: 12, sell: 18 });
    expect(series.closing).toEqual({ cost: 20, sell: 30 });
    expect(series.points).toEqual([
      { date: "2026-10-01", cost: 12, sell: 18 },
      { date: "2026-10-02", cost: 20, sell: 30 },
    ]);
  });

  it("counts stock received on the first day only in the after figure", () => {
    const series = buildInventoryValueSeries({
      startDate: start,
      endDate: end,
      stock: [{ key: "br:rice", quantity: 10, costPrice: 2, sellingPrice: 3 }],
      movements: [
        { key: "br:rice", quantityChange: 2, at: Date.parse("2026-10-01T12:00:00.000Z") },
        { key: "br:rice", quantityChange: 4, at: Date.parse("2026-10-02T12:00:00.000Z") },
      ],
    });
    expect(series.opening).toEqual({ cost: 8, sell: 12 });
    expect(series.closing).toEqual({ cost: 20, sell: 30 });
    expect(series.points[0]).toEqual({ date: "2026-10-01", cost: 12, sell: 18 });
  });

  it("ignores non-stock catalogue lines", () => {
    const series = buildInventoryValueSeries({
      startDate: start,
      endDate: start,
      stock: [
        {
          key: "br:service",
          quantity: 100,
          costPrice: 5,
          sellingPrice: 9,
          tracksInventory: false,
        },
      ],
      movements: [],
    });
    expect(series.points[0]).toEqual({ date: "2026-10-01", cost: 0, sell: 0 });
    expect(series.opening).toEqual({ cost: 0, sell: 0 });
    expect(series.closing).toEqual({ cost: 0, sell: 0 });
  });
});

describe("findInventoryValueDays", () => {
  const points = [
    { date: "2026-10-01", cost: 12, sell: 18 },
    { date: "2026-10-02", cost: 20, sell: 30 },
  ];

  it("returns the day that matches the amount", () => {
    expect(findInventoryValueDays(points, 12, "cost").exact.map((point) => point.date)).toEqual([
      "2026-10-01",
    ]);
  });

  it("returns the closest day when nothing matches", () => {
    const found = findInventoryValueDays(points, 19, "cost");
    expect(found.exact).toEqual([]);
    expect(found.closest?.date).toBe("2026-10-02");
  });
});
