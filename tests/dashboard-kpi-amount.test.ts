import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CURRENCY_SYMBOL, formatCurrency, formatMoneyAmount } from "@/lib/currency";

const dashboard = readFileSync(
  resolve(process.cwd(), "features/dashboard/components/dashboard-view.tsx"),
  "utf8",
);

describe("dashboard KPI amounts", () => {
  it("formats money without the symbol and exposes the symbol separately", () => {
    expect(formatMoneyAmount(1234.5)).toBe("1,234.50");
    expect(formatMoneyAmount(0)).toBe("0.00");
    expect(formatMoneyAmount(-12)).toBe("-12.00");
    expect(CURRENCY_SYMBOL.length).toBeGreaterThan(0);
    expect(formatCurrency(1)).toContain(CURRENCY_SYMBOL);
    expect(formatMoneyAmount(1)).not.toContain(CURRENCY_SYMBOL);
  });

  it("keeps the currency symbol beside the title, not in the value", () => {
    expect(dashboard).toContain("value: formatMoneyAmount(data.kpis.revenue)");
    expect(dashboard).toContain("unit: CURRENCY_SYMBOL");
    expect(dashboard).not.toContain("value: formatCurrency(");
    expect(dashboard).not.toContain("value={formatCurrency(");
  });

  it("never truncates the KPI value", () => {
    const kpiValue = dashboard.slice(
      dashboard.indexOf("function KpiValue("),
      dashboard.indexOf("function KpiTitle("),
    );
    expect(kpiValue).toContain("whitespace-nowrap");
    expect(kpiValue).toContain("@container");
    expect(kpiValue).not.toContain("truncate");
  });
});
