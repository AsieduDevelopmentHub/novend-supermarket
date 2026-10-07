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

/** Clock time for SMS, in the business timezone. */
export function formatBusinessTime(at: number, timeZone?: string | null) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: businessTimeZone(timeZone),
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(at));
}
