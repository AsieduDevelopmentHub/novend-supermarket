/** Default till timezone when an organization has not set one. */
export const DEFAULT_BUSINESS_TIMEZONE = "Africa/Accra";

export function businessTimeZone(timeZone?: string | null) {
  const zone = timeZone?.trim();
  if (!zone) return DEFAULT_BUSINESS_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(new Date());
    return zone;
  } catch {
    return DEFAULT_BUSINESS_TIMEZONE;
  }
}

/** Calendar day in the business timezone, `YYYY-MM-DD`. */
export function businessDateKey(at: number, timeZone?: string | null) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: businessTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(at));
}

const CLOCK_IN_FUTURE_SKEW_MS = 2 * 60 * 1000;
const CLOCK_IN_MAX_PAST_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Prefer the till's saved login time. Ignore a clock that is far ahead or
 * more than a week old. Do not replace a clock-in already stored for a later day.
 */
export function resolveReportedClockIn(args: {
  now: number;
  reportedAt?: number | null;
  existingOn?: string | null;
  timeZone?: string | null;
}): { at: number; on: string; record: boolean } {
  let at = args.now;
  if (typeof args.reportedAt === "number" && Number.isFinite(args.reportedAt)) {
    if (
      args.reportedAt <= args.now + CLOCK_IN_FUTURE_SKEW_MS &&
      args.reportedAt >= args.now - CLOCK_IN_MAX_PAST_MS
    ) {
      at = args.reportedAt;
    }
  }
  const on = businessDateKey(at, args.timeZone);
  const existing = args.existingOn ?? "";
  return { at, on, record: !existing || on > existing };
}

/** Clock time for SMS, in the business timezone. */
export function formatBusinessTime(at: number, timeZone?: string | null) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: businessTimeZone(timeZone),
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(at));
}
