/**
 * Organization default for product expiry alert windows.
 * Key: `inventory.expiry` → `{ defaultAlertDays: number }` (default 30).
 * Products may override with `products.expiryAlertDays`; unset = use this default.
 */

export const EXPIRY_POLICY_SETTINGS_KEY = "inventory.expiry";

export const DEFAULT_EXPIRY_ALERT_DAYS = 30;
export const MIN_EXPIRY_ALERT_DAYS = 0;
export const MAX_EXPIRY_ALERT_DAYS = 3650;

export type ExpiryPolicy = {
  defaultAlertDays: number;
};

export const DEFAULT_EXPIRY_POLICY: ExpiryPolicy = {
  defaultAlertDays: DEFAULT_EXPIRY_ALERT_DAYS,
};

export function clampExpiryAlertDays(value: number): number {
  return Math.min(MAX_EXPIRY_ALERT_DAYS, Math.max(MIN_EXPIRY_ALERT_DAYS, Math.floor(value)));
}

export function isValidExpiryAlertDays(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_EXPIRY_ALERT_DAYS && value <= MAX_EXPIRY_ALERT_DAYS;
}

/** Parse stored JSON; missing / invalid → 30-day default. */
export function parseExpiryPolicy(raw: string | undefined): ExpiryPolicy {
  if (!raw) return { ...DEFAULT_EXPIRY_POLICY };
  try {
    const parsed = JSON.parse(raw) as Partial<ExpiryPolicy>;
    const days = parsed.defaultAlertDays;
    if (typeof days === "number" && isValidExpiryAlertDays(days)) {
      return { defaultAlertDays: clampExpiryAlertDays(days) };
    }
    return { ...DEFAULT_EXPIRY_POLICY };
  } catch {
    return { ...DEFAULT_EXPIRY_POLICY };
  }
}

/**
 * Effective alert window for a product.
 * Finite product override wins; otherwise the org default (or hardcoded 30).
 */
export function resolveExpiryAlertDays(
  product: { expiryAlertDays?: number | null },
  orgDefault: number = DEFAULT_EXPIRY_ALERT_DAYS,
): number {
  const days = product.expiryAlertDays;
  if (typeof days === "number" && Number.isFinite(days) && days >= 0) {
    return clampExpiryAlertDays(days);
  }
  return isValidExpiryAlertDays(orgDefault)
    ? clampExpiryAlertDays(orgDefault)
    : DEFAULT_EXPIRY_ALERT_DAYS;
}
