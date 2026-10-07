import { describe, expect, it } from "vitest";
import { mergeDayOrdersWithLocal, mergeSalesReportWithLocal } from "@/lib/offline/report-merge";
import type { LocalSalesReport } from "@/lib/offline/ui-cache";

function report(
  daily: LocalSalesReport["daily"],
  extras?: Partial<LocalSalesReport["kpis"]>,
): LocalSalesReport {
  const totalOrders = daily.reduce((sum, row) => sum + row.orders, 0);
  const totalSales = daily.reduce((sum, row) => sum + row.totalSales, 0);
  return {
    kpis: {
      totalSales,
      totalOrders,
      itemsSold: daily.reduce((sum, row) => sum + row.itemsSold, 0),
      averageOrder: totalOrders ? totalSales / totalOrders : 0,
      ...extras,
    },
    trend: daily.map((row) => ({ date: row.date, total: row.totalSales })),
    daily,
  };
}

describe("report merge", () => {
  it("keeps a device-only sale day that the cloud has not received", () => {
    const remote = report([{ date: "2026-10-07", orders: 2, itemsSold: 4, totalSales: 40, refunds: 0 }]);
    const local = report([
      { date: "2026-10-07", orders: 3, itemsSold: 5, totalSales: 55, refunds: 0 },
    ]);
    const merged = mergeSalesReportWithLocal(remote, local);
    expect(merged?.daily[0]?.orders).toBe(3);
    expect(merged?.kpis.totalOrders).toBe(3);
    expect(merged?.kpis.totalSales).toBe(55);
  });

  it("does not drop a cloud day that is absent from the local mirror", () => {
    const remote = report([
      { date: "2026-10-06", orders: 1, itemsSold: 1, totalSales: 10, refunds: 0 },
      { date: "2026-10-07", orders: 1, itemsSold: 1, totalSales: 12, refunds: 0 },
    ]);
    const local = report([{ date: "2026-10-07", orders: 1, itemsSold: 1, totalSales: 12, refunds: 0 }]);
    const merged = mergeSalesReportWithLocal(remote, local);
    expect(merged?.daily.map((row) => row.date)).toEqual(["2026-10-06", "2026-10-07"]);
  });

  it("appends local-only invoices onto a cloud day order list", () => {
    const merged = mergeDayOrdersWithLocal(
      [
        {
          id: "sale_1",
          invoiceNumber: "NV-AAA",
          completedAt: 2,
          total: 10,
          itemCount: 1,
        },
      ],
      [
        {
          id: "sale_1",
          invoiceNumber: "NV-AAA",
          completedAt: 2,
          total: 10,
          itemCount: 1,
        },
        {
          id: "lsale_2",
          invoiceNumber: "NV-93EE35DADA5B4BBC",
          completedAt: 3,
          total: 20,
          itemCount: 2,
        },
      ],
    );
    expect(merged.map((row) => row.invoiceNumber)).toEqual(["NV-93EE35DADA5B4BBC", "NV-AAA"]);
  });
});
