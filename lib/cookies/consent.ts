/**
 * Marketing-site cookie consent (localStorage + first-party cookie backup).
 * Necessary cookies are always on; preferences/analytics are opt-in.
 */

export const COOKIE_CONSENT_STORAGE_KEY = "novend.cookie-consent.v1";
export const COOKIE_CONSENT_COOKIE_NAME = "novend_cookie_consent";
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

export type CookiePreferencesDetail = {
  open?: boolean;
  saved?: boolean;
};

/** In-memory mirror so remounts / same-tab instances see the choice immediately. */
let memoryConsent: CookieConsent | null = null;

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

/** Accept near-valid stored shapes and normalize to the current schema. */
function normalizeConsent(value: unknown): CookieConsent | null {
  if (isConsent(value)) return value;
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.preferences !== "boolean" || typeof row.analytics !== "boolean") {
    return null;
  }
  if (row.version != null && row.version !== COOKIE_CONSENT_VERSION) {
    return null;
  }
  return {
    version: COOKIE_CONSENT_VERSION,
    necessary: true,
    preferences: row.preferences,
    analytics: row.analytics,
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : Date.now(),
  };
}

function readConsentCookie(): CookieConsent | null {
  if (typeof document === "undefined") return null;
  try {
    const parts = document.cookie.split("; ");
    const prefix = `${COOKIE_CONSENT_COOKIE_NAME}=`;
    const match = parts.find((part) => part.startsWith(prefix));
    if (!match) return null;
    const raw = decodeURIComponent(match.slice(prefix.length));
    return normalizeConsent(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeConsentCookie(consent: CookieConsent) {
  if (typeof document === "undefined") return;
  try {
    const value = encodeURIComponent(JSON.stringify(consent));
    document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    /* private / blocked cookies */
  }
}

export function readCookieConsent(): CookieConsent | null {
  if (memoryConsent) return memoryConsent;
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (raw) {
      const parsed = normalizeConsent(JSON.parse(raw) as unknown);
      if (parsed) {
        memoryConsent = parsed;
        return parsed;
      }
    }
  } catch {
    /* private mode / blocked storage */
  }

  const fromCookie = readConsentCookie();
  if (fromCookie) {
    memoryConsent = fromCookie;
    try {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(fromCookie));
    } catch {
      /* ignore */
    }
    return fromCookie;
  }

  return null;
}

export function writeCookieConsent(choices: CookieConsentChoices): CookieConsent {
  const next: CookieConsent = {
    version: COOKIE_CONSENT_VERSION,
    necessary: true,
    preferences: choices.preferences,
    analytics: choices.analytics,
    updatedAt: Date.now(),
  };

  memoryConsent = next;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode — cookie + memory still keep the choice for this session */
    }
    writeConsentCookie(next);
    window.dispatchEvent(
      new CustomEvent<CookiePreferencesDetail>(COOKIE_PREFERENCES_EVENT, {
        detail: { saved: true },
      }),
    );
  }

  return next;
}

export function hasAnalyticsConsent(): boolean {
  return readCookieConsent()?.analytics === true;
}

export function hasPreferencesConsent(): boolean {
  return readCookieConsent()?.preferences === true;
}

/** True when the visitor has already accepted or rejected optional cookies. */
export function hasCookieConsentDecision(): boolean {
  return readCookieConsent() !== null;
}

/** Re-open the banner’s preference panel (footer “Cookie settings”). */
export function openCookiePreferences() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<CookiePreferencesDetail>(COOKIE_PREFERENCES_EVENT, {
      detail: { open: true },
    }),
  );
}

/** Test helper — clear memory + storage mirrors. */
export function resetCookieConsentForTests() {
  memoryConsent = null;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  if (typeof document !== "undefined") {
    try {
      document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
    } catch {
      /* ignore */
    }
  }
}
