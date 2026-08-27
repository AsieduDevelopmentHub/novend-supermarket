import { describe, expect, it } from "vitest";
import {
  collectTopSellingCandidates,
  parseTopSellingMetric,
  sortTopSelling,
} from "@/lib/dashboard/top-selling";

const water = { id: "1", name: "Water", quantity: 40, total: 80 };
const phone = { id: "2", name: "Phone", quantity: 2, total: 4000 };
const soap = { id: "3", name: "Soap", quantity: 12, total: 120 };

describe("top selling", () => {
  it("defaults unknown values to quantity", () => {
    expect(parseTopSellingMetric("amount")).toBe("amount");
    expect(parseTopSellingMetric("quantity")).toBe("quantity");
    expect(parseTopSellingMetric("nope")).toBe("quantity");
  });

  it("ranks by units sold, then by amount", () => {
    expect(sortTopSelling([phone, water, soap], "quantity").map((row) => row.name)).toEqual([
      "Water",
      "Soap",
      "Phone",
    ]);
  });

  it("ranks by amount, then by units sold", () => {
    expect(sortTopSelling([water, soap, phone], "amount").map((row) => row.name)).toEqual([
      "Phone",
      "Soap",
      "Water",
    ]);
  });

  it("keeps high-volume and high-value products when capping the candidate list", () => {
    const rows = Array.from({ length: 50 }, (_, index) => ({
      id: String(index),
      name: `P${index}`,
      quantity: index === 49 ? 100 : 1,
      total: index === 0 ? 9_000 : 10,
    }));
    const candidates = collectTopSellingCandidates(rows, 5);
    expect(candidates.some((row) => row.id === "49")).toBe(true);
    expect(candidates.some((row) => row.id === "0")).toBe(true);
  });
});
