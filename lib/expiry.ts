import { format } from "date-fns";

export const DEFAULT_EXPIRY_ALERT_DAYS = 30;

export type LotStatus = "expired" | "expiring" | "ok";

export function todayDateString(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function formatExpiryDate(isoDate: string) {
  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return format(parsed, "dd MMM yyyy");
}

export function lotStatus(
  expiryDate: string,
  alertDays: number,
  today = todayDateString(),
): LotStatus {
  if (expiryDate < today) return "expired";
  const start = Date.parse(`${today}T00:00:00.000Z`);
  const end = Date.parse(`${expiryDate}T00:00:00.000Z`);
  const days = Math.round((end - start) / 86_400_000);
  if (days <= alertDays) return "expiring";
  return "ok";
}
