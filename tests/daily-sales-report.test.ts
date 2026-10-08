import { describe, expect, it } from "vitest";
import { clockInSms, welcomeSms } from "@/convex/shared/emailTemplates";
import {
  addReturn,
  addSale,
  businessDayRange,
  dailySalesInbox,
  dailySalesSms,
  emptyDailySales,
  formatMoney,
  reportDateKey,
} from "@/convex/shared/dailySalesReport";

describe("daily sales report", () => {
  it("closes the Accra business day at local midnight", () => {
    const range = businessDayRange("2026-10-08", "Africa/Accra");
    expect(range.start).toBe(Date.parse("2026-10-08T00:00:00.000Z"));
    expect(range.end).toBe(Date.parse("2026-10-09T00:00:00.000Z"));
  });

  it("reports today after 8pm local and yesterday before that", () => {
    const evening = Date.parse("2026-10-08T21:00:00.000Z");
    const morning = Date.parse("2026-10-08T10:00:00.000Z");
    expect(reportDateKey(evening, "Africa/Accra")).toBe("2026-10-08");
    expect(reportDateKey(morning, "Africa/Accra")).toBe("2026-10-07");
  });

  it("writes a short administrator SMS with tenders and net after returns", () => {
    let figures = emptyDailySales();
    figures = addSale(figures, { total: 900, paymentMethod: "cash" });
    figures = addSale(figures, { total: 340.5, paymentMethod: "mobile_money" });
    figures = addReturn(figures, { refundAmount: 20, status: "completed" });
    figures = addReturn(figures, { refundAmount: 50, status: "pending" });
    const reportsUrl = "https://dashboard.novendpos.app/reports";
    const sms = dailySalesSms({
      organizationName: "Minta Shop",
      dateKey: "2026-10-08",
      currency: "GHS",
      figures,
      reportsUrl,
    });
    expect(sms).toContain("Novend daily: Minta Shop, 8 Oct.");
    expect(sms).toContain("2 sales, GHS 1,240.50.");
    expect(sms).toContain("Cash GHS 900.00");
    expect(sms).toContain("MoMo GHS 340.50");
    expect(sms).not.toContain("Card");
    expect(sms).toContain("Returns GHS 20.00 (1). Net GHS 1,220.50.");
    expect(sms.endsWith(reportsUrl)).toBe(true);
    expect(sms.length).toBeLessThanOrEqual(320);
    expect(formatMoney(0, "GHS")).toBe("GHS 0.00");
  });

  it("points the in-app notice at reports", () => {
    const inbox = dailySalesInbox({
      organizationName: "Minta Shop",
      dateKey: "2026-10-08",
      currency: "GHS",
      figures: emptyDailySales(),
    });
    expect(inbox.title).toBe("Daily sales · 8 Oct");
    expect(inbox.body).toContain("No completed sales");
    expect(inbox.href).toBe("/reports");
  });
});

describe("sms templates", () => {
  it("keeps welcome and clock-in messages personal and branded", () => {
    const signInUrl = "https://dashboard.novendpos.app/login";
    expect(welcomeSms("Ama", "Minta Shop", signInUrl)).toBe(
      `Novend: Welcome, Ama. Minta Shop is ready. Sign in to start selling. ${signInUrl}`,
    );
    const staffUrl = "https://dashboard.novendpos.app/users";
    expect(
      clockInSms({
        cashierName: "Ama",
        time: "8:05 am",
        branchName: "Main Branch",
        staffUrl,
      }),
    ).toBe(`Novend: Ama clocked in at 8:05 am, Main Branch. ${staffUrl}`);
  });
});
