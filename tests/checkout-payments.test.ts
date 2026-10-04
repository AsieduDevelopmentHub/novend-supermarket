import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { periodPresetShortLabel } from "@/lib/period-filter";
import { paymentMethodLabel, PAYMENT_METHOD_OPTIONS } from "@/lib/payments";

const sales = readFileSync(
  resolve(process.cwd(), "features/sales/components/sales-view.tsx"),
  "utf8",
);

describe("checkout payments", () => {
  it("offers cash first, then MoMo and card", () => {
    expect(PAYMENT_METHOD_OPTIONS.map((option) => option.label)).toEqual(["Cash", "MoMo", "Card"]);
    expect(paymentMethodLabel("mobile_money")).toBe("MoMo");
    expect(PAYMENT_METHOD_OPTIONS).toHaveLength(3);
  });

  it("defaults the till to cash and no longer blocks another branch offline", () => {
    expect(sales).toContain('useState<PaymentMethod>("cash")');
    expect(sales).toContain("paymentMethod,");
    expect(sales).not.toContain("Connect to the internet to sell from another branch");
  });

  it("keeps dashboard period titles short enough for one line", () => {
    expect(periodPresetShortLabel("last_7_days")).toBe("7d");
    expect(periodPresetShortLabel("last_30_days")).toBe("30d");
    expect(periodPresetShortLabel("this_month")).toBe("Month");
  });
});
