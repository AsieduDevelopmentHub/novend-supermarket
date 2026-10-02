import { format } from "date-fns";
import { toLocalDateInput } from "@/lib/date";

export {
  DEFAULT_EXPIRY_ALERT_DAYS,
  resolveExpiryAlertDays,
  type ExpiryPolicy,
  DEFAULT_EXPIRY_POLICY,
} from "@/convex/shared/expiryPolicy";

export type LotStatus = "expired" | "expiring" | "ok";

/** Local calendar day — UTC `toISOString` flipped Ghana/EU dates near midnight. */
export function todayDateString(now = Date.now()): string {
  return toLocalDateInput(new Date(now));
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

/** Units that belong on an expiry alert (expired + FEFO alert-window), not full on-hand. */
export function expiryAlertQuantity(row: {
  isExpired?: boolean;
  isExpiring?: boolean;
  expiredQuantity?: number;
  expiringQuantity?: number;
}): number {
  return (
    (row.isExpired ? (row.expiredQuantity ?? 0) : 0) +
    (row.isExpiring ? (row.expiringQuantity ?? 0) : 0)
  );
}
