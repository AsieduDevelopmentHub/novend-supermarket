import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_PREFERENCES_EVENT,
  hasAnalyticsConsent,
  hasCookieConsentDecision,
  openCookiePreferences,
  readCookieConsent,
  resetCookieConsentForTests,
  writeCookieConsent,
} from "@/lib/cookies/consent";

describe("cookie consent storage", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    let cookieJar = "";
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
    vi.stubGlobal("document", {
      get cookie() {
        return cookieJar;
      },
      set cookie(value: string) {
        const [pair] = value.split(";");
        const eq = pair.indexOf("=");
        const name = pair.slice(0, eq);
        const raw = pair.slice(eq + 1);
        if (value.includes("Max-Age=0")) {
          cookieJar = cookieJar
            .split("; ")
            .filter((part) => part && !part.startsWith(`${name}=`))
            .join("; ");
          return;
        }
        const next = `${name}=${raw}`;
        const others = cookieJar.split("; ").filter((part) => part && !part.startsWith(`${name}=`));
        cookieJar = [...others, next].filter(Boolean).join("; ");
      },
    });
    vi.stubGlobal("window", {
      localStorage: globalThis.localStorage,
      dispatchEvent: vi.fn(),
    });
    resetCookieConsentForTests();
  });

  afterEach(() => {
    resetCookieConsentForTests();
    vi.unstubAllGlobals();
  });

  it("returns null when unset", () => {
    expect(readCookieConsent()).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
    expect(hasCookieConsentDecision()).toBe(false);
  });

  it("persists opt-in analytics", () => {
    writeCookieConsent({ preferences: false, analytics: true });
    const saved = readCookieConsent();
    expect(saved?.necessary).toBe(true);
    expect(saved?.analytics).toBe(true);
    expect(saved?.preferences).toBe(false);
    expect(hasAnalyticsConsent()).toBe(true);
    expect(hasCookieConsentDecision()).toBe(true);
    expect(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toContain('"analytics":true');
    expect(document.cookie).toContain(COOKIE_CONSENT_COOKIE_NAME);
  });

  it("keeps the choice in memory after storage mirrors are cleared", () => {
    writeCookieConsent({ preferences: true, analytics: false });
    localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
    document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
    expect(readCookieConsent()?.preferences).toBe(true);
    expect(hasCookieConsentDecision()).toBe(true);
  });

  it("restores from the consent cookie when localStorage is empty", () => {
    writeCookieConsent({ preferences: false, analytics: true });
    resetCookieConsentForTests();
    // Re-seed only the cookie (simulates LS cleared but cookie retained).
    const payload = encodeURIComponent(
      JSON.stringify({
        version: 1,
        necessary: true,
        preferences: false,
        analytics: true,
        updatedAt: Date.now(),
      }),
    );
    document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${payload}`;
    const restored = readCookieConsent();
    expect(restored?.analytics).toBe(true);
    expect(hasCookieConsentDecision()).toBe(true);
  });

  it("ignores corrupt storage", () => {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "{not-json");
    expect(readCookieConsent()).toBeNull();
  });

  it("normalizes near-valid stored consent", () => {
    localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      JSON.stringify({ preferences: true, analytics: false }),
    );
    const saved = readCookieConsent();
    expect(saved?.necessary).toBe(true);
    expect(saved?.preferences).toBe(true);
    expect(saved?.version).toBe(1);
  });

  it("dispatches saved then open preference events", () => {
    writeCookieConsent({ preferences: true, analytics: true });
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: COOKIE_PREFERENCES_EVENT,
        detail: { saved: true },
      }),
    );

    openCookiePreferences();
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: COOKIE_PREFERENCES_EVENT,
        detail: { open: true },
      }),
    );
  });
});
