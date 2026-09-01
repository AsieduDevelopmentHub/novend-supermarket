import { describe, expect, it } from "vitest";
import {
  assertPayPeriodKey,
  computeCommissionEarned,
  currentPayPeriodKey,
  isPayPeriodKey,
  isPayrollExpense,
  periodBounds,
} from "@/convex/shared/payroll";

describe("payroll periods", () => {
  it("accepts monthly and weekly keys", () => {
    expect(isPayPeriodKey("2026-09", "monthly")).toBe(true);
    expect(isPayPeriodKey("2026-13", "monthly")).toBe(false);
    expect(isPayPeriodKey("2026-W12", "weekly")).toBe(true);
    expect(isPayPeriodKey("2026-09", "weekly")).toBe(false);
    expect(assertPayPeriodKey("2026-09", "monthly")).toBe("2026-09");
  });

  it("returns UTC bounds for a calendar month", () => {
    const { start, end } = periodBounds("2026-09");
    expect(new Date(start).toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(new Date(end).toISOString()).toBe("2026-09-30T23:59:59.999Z");
  });

  it("returns ISO week bounds Monday–Sunday", () => {
    const { start, end } = periodBounds("2026-W01");
    expect(new Date(start).getUTCDay()).toBe(1);
    expect(new Date(end).getUTCDay()).toBe(0);
  });

  it("formats the current monthly period as YYYY-MM", () => {
    expect(currentPayPeriodKey("monthly", new Date("2026-09-01T12:00:00Z"))).toBe("2026-09");
  });
});

describe("commission earned", () => {
  it("uses net sales after returns by default", () => {
    expect(
      computeCommissionEarned({ netSales: 1000, grossSales: 1200, rate: 5, basis: "net" }),
    ).toBe(50);
    expect(
      computeCommissionEarned({ netSales: 1000, grossSales: 1200, rate: 5, basis: "gross" }),
    ).toBe(60);
  });

  it("does not go negative and ignores a zero rate", () => {
    expect(computeCommissionEarned({ netSales: -10, grossSales: 0, rate: 5, basis: "net" })).toBe(
      0,
    );
    expect(
      computeCommissionEarned({ netSales: 1000, grossSales: 1000, rate: 0, basis: "net" }),
    ).toBe(0);
  });
});

describe("payroll expenses", () => {
  it("treats salary and commission source kinds as protected history", () => {
    expect(isPayrollExpense({ sourceKind: "salary" })).toBe(true);
    expect(isPayrollExpense({ sourceKind: "commission" })).toBe(true);
    expect(isPayrollExpense({ sourceKind: "manual" })).toBe(false);
  });
});
