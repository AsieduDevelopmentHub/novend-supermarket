import { describe, expect, it } from "vitest";
import {
  filterCashierDashboardReturns,
  filterCashierDashboardSales,
} from "@/lib/dashboard/cashier-scope";

describe("cashier dashboard scope", () => {
  it("keeps every sale for administrators", () => {
    const rows = [
      { id: "a", cashierId: "admin" },
      { id: "b", cashierId: "cash1" },
    ];
    expect(filterCashierDashboardSales(rows, "administrator", "admin")).toEqual(rows);
  });

  it("keeps only the signed-in cashier's sales", () => {
    const rows = [
      { id: "a", cashierId: "cash1" },
      { id: "b", cashierId: "cash2" },
    ];
    expect(filterCashierDashboardSales(rows, "cashier", "cash1")).toEqual([
      { id: "a", cashierId: "cash1" },
    ]);
  });

  it("subtracts only refunds that belong to the cashier's sales", () => {
    const returns = [
      { id: "r1", saleId: "a", refundAmount: 10 },
      { id: "r2", saleId: "other", refundAmount: 90 },
    ];
    expect(filterCashierDashboardReturns(returns, new Set(["a"]), "cashier")).toEqual([
      { id: "r1", saleId: "a", refundAmount: 10 },
    ]);
  });
});
