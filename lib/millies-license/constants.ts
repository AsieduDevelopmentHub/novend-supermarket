export const TRIAL_DAYS = 7;
export const LICENSE_PREFIX = "NMIL";

/** Must match scripts/issue-millies-license.mjs. Override via NEXT_PUBLIC_MILLIES_LICENSE_SECRET. */
export const DEFAULT_LICENSE_SECRET = "milliesmart-asiedu-default-v1";

export function resolveLicenseSecret(): string {
  const fromEnv =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_MILLIES_LICENSE_SECRET?.trim()
      : undefined;
  return fromEnv || DEFAULT_LICENSE_SECRET;
}
