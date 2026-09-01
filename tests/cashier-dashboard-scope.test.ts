import { describe, expect, it } from "vitest";
import {
  filterCashierDashboardReturns,
  filterCashierDashboardSales,
  ownedSaleIdsForCashier,
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

  it("collects only the cashier's mirrored and local sale ids", () => {
    const ids = ownedSaleIdsForCashier(
      "cashier",
      "cash1",
      [
        { id: "s1", cashierId: "cash1" },
        { id: "s2", cashierId: "cash2" },
      ],
      [{ id: "local_1", cashierId: "cash1", serverSaleId: "s1-server" }],
    );
    expect(ids).toEqual(new Set(["s1", "local_1", "s1-server"]));
  });

  it("does not sale-filter admin or manager lists", () => {
    expect(ownedSaleIdsForCashier("administrator", "admin", [{ id: "s1" }], [])).toBeNull();
    expect(ownedSaleIdsForCashier("manager", "mgr", [{ id: "s1" }], [])).toBeNull();
  });
});
