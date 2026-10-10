import { describe, expect, it } from "vitest";
import { payrollPaymentSms } from "@/convex/shared/emailTemplates";
import { planCapabilities } from "@/convex/shared/capabilities";

describe("payroll payment SMS", () => {
  it("copies salary and commission alerts without mentioning orders", () => {
    const salary = payrollPaymentSms({
      kind: "salary",
      staffName: "Ama",
      amountLabel: "GHS 500.00",
      payPeriodKey: "2026-10",
      organizationName: "Minta Shop",
      staffUrl: "https://dashboard.novendpos.app/users",
    });
    expect(salary).toMatch(/salary/i);
    expect(salary).toContain("GHS 500.00");
    expect(salary).toContain("2026-10");
    expect(salary.toLowerCase()).not.toMatch(/order|checkout|sale/);

    const commission = payrollPaymentSms({
      kind: "commission",
      staffName: "Kofi",
      amountLabel: "GHS 80.00",
      payPeriodKey: "2026-W40",
    });
    expect(commission).toMatch(/commission/i);
    expect(commission.toLowerCase()).not.toMatch(/order|checkout/);
  });

  it("gates salary SMS on Pro+ capabilities", () => {
    expect(planCapabilities("growth").canSmsSalaryAlerts).toBe(false);
    expect(planCapabilities("pro").canSmsSalaryAlerts).toBe(true);
    expect(planCapabilities("pro").canManageStaffCompensation).toBe(true);
  });
});
