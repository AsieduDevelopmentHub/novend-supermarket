import { roundMoney } from "./validation";

export type SalaryFrequency = "monthly" | "weekly";
export type CommissionBasis = "net" | "gross";
export type PayrollSourceKind = "manual" | "salary" | "commission";

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;
const WEEK_KEY = /^(\d{4})-W(0[1-9]|[1-4]\d|5[0-3])$/;

export function isPayPeriodKey(value: string, frequency: SalaryFrequency): boolean {
  return frequency === "weekly" ? WEEK_KEY.test(value) : MONTH_KEY.test(value);
}

export function assertPayPeriodKey(value: string, frequency: SalaryFrequency): string {
  const trimmed = value.trim();
  if (!isPayPeriodKey(trimmed, frequency)) {
    throw new Error(
      frequency === "weekly"
        ? "Pay period must look like 2026-W12"
        : "Pay period must look like 2026-09",
    );
  }
  return trimmed;
}

/** UTC bounds for a monthly (YYYY-MM) or ISO-week (YYYY-Www) pay period. */
export function periodBounds(payPeriodKey: string): { start: number; end: number } {
  const month = MONTH_KEY.exec(payPeriodKey);
  if (month) {
    const year = Number(month[1]);
    const monthIndex = Number(month[2]) - 1;
    return {
      start: Date.UTC(year, monthIndex, 1, 0, 0, 0, 0),
      end: Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999),
    };
  }
  const week = WEEK_KEY.exec(payPeriodKey);
  if (!week) throw new Error("Invalid pay period");
  return isoWeekBounds(Number(week[1]), Number(week[2]));
}

function isoWeekBounds(year: number, week: number): { start: number; end: number } {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return { start: monday.getTime(), end: sunday.getTime() };
}

export function currentPayPeriodKey(frequency: SalaryFrequency, now: Date = new Date()): string {
  if (frequency === "monthly") {
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** `rate` is a percent (5 = 5%). */
export function computeCommissionEarned(args: {
  netSales: number;
  grossSales: number;
  rate: number;
  basis: CommissionBasis;
}): number {
  if (!Number.isFinite(args.rate) || args.rate <= 0) return 0;
  const base = args.basis === "gross" ? args.grossSales : args.netSales;
  return roundMoney(Math.max(0, base) * (args.rate / 100));
}

export function isPayrollExpense(row: { sourceKind?: PayrollSourceKind | string | null }): boolean {
  return row.sourceKind === "salary" || row.sourceKind === "commission";
}
