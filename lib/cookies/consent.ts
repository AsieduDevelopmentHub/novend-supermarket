/**
 * Marketing-site cookie consent (localStorage).
 * Necessary cookies are always on; preferences/analytics are opt-in.
 */

export const COOKIE_CONSENT_STORAGE_KEY = "novend.cookie-consent.v1";
export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_PREFERENCES_EVENT = "novend:cookie-preferences";

export type CookieConsent = {
  version: typeof COOKIE_CONSENT_VERSION;
  necessary: true;
  preferences: boolean;
  analytics: boolean;
  updatedAt: number;
};

export type CookieConsentChoices = {
  preferences: boolean;
  analytics: boolean;
};

function isConsent(value: unknown): value is CookieConsent {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    row.version === COOKIE_CONSENT_VERSION &&
    row.necessary === true &&
    typeof row.preferences === "boolean" &&
    typeof row.analytics === "boolean" &&
    typeof row.updatedAt === "number"
  );
}

export function readCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isConsent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCookieConsent(choices: CookieConsentChoices): CookieConsent {
  const next: CookieConsent = {
    version: COOKIE_CONSENT_VERSION,
    necessary: true,
    preferences: choices.preferences,
    analytics: choices.analytics,
    updatedAt: Date.now(),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(COOKIE_PREFERENCES_EVENT, { detail: { saved: true } }));
  }
  return next;
}

export function hasAnalyticsConsent(): boolean {
  return readCookieConsent()?.analytics === true;
}

export function hasPreferencesConsent(): boolean {
  return readCookieConsent()?.preferences === true;
}

/** Re-open the banner’s preference panel (footer “Cookie settings”). */
export function openCookiePreferences() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COOKIE_PREFERENCES_EVENT, { detail: { open: true } }));
}
