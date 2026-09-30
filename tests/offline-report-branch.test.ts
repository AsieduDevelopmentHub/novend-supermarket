import { describe, expect, it, vi } from "vitest";
const { getOfflineDb } = vi.hoisted(() => ({ getOfflineDb: vi.fn() }));
vi.mock("@/lib/offline/db", () => ({
  getOfflineDb,
  getMeta: vi.fn(),
  setMeta: vi.fn(),
  META_KEYS: {},
}));
import { buildLocalSalesReport } from "@/lib/offline/ui-cache";

describe("offline report branch scope", () => {
  it("filters sales and refunds, including returns for older sales", async () => {
    const orders = [
      { id: "old-a", branchId: "a", completedAt: 1, total: 100, itemCount: 1, invoiceNumber: "old" },
      { id: "a1", branchId: "a", completedAt: 20, total: 50, itemCount: 2, invoiceNumber: "a1" },
      { id: "b1", branchId: "b", completedAt: 20, total: 200, itemCount: 4, invoiceNumber: "b1" },
    ];
    const localSales = [
      { id: "la", branchId: "a", completedAt: 20, total: 30, itemCount: 1, invoiceNumber: "la", syncStatus: "pending" },
      { id: "lb", branchId: "b", completedAt: 20, total: 40, itemCount: 1, invoiceNumber: "lb", syncStatus: "pending" },
    ];
    const returns = [
      { saleId: "old-a", completedAt: 25, refundAmount: 10, itemCount: 1 },
      { saleId: "b1", completedAt: 25, refundAmount: 20, itemCount: 1 },
    ];
    getOfflineDb.mockResolvedValue({
      orders: { toArray: async () => orders },
      localSales: { toArray: async () => localSales },
      localReturns: { toArray: async () => returns },
    });
    const branch = await buildLocalSalesReport(10, 30, "a");
    expect(branch.kpis).toMatchObject({
      grossSales: 80, totalRefunds: 10, totalSales: 70, totalOrders: 2, itemsSold: 2,
    });
    const all = await buildLocalSalesReport(10, 30);
    expect(all.kpis).toMatchObject({
      grossSales: 320, totalRefunds: 30, totalSales: 290, totalOrders: 4,
    });
  });
});
