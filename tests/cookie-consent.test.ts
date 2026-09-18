import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  hasAnalyticsConsent,
  readCookieConsent,
  writeCookieConsent,
} from "@/lib/cookies/consent";

describe("cookie consent storage", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
    vi.stubGlobal("window", {
      localStorage: globalThis.localStorage,
      dispatchEvent: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when unset", () => {
    expect(readCookieConsent()).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("persists opt-in analytics", () => {
    writeCookieConsent({ preferences: false, analytics: true });
    const saved = readCookieConsent();
    expect(saved?.necessary).toBe(true);
    expect(saved?.analytics).toBe(true);
    expect(saved?.preferences).toBe(false);
    expect(hasAnalyticsConsent()).toBe(true);
    expect(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toContain('"analytics":true');
  });

  it("ignores corrupt storage", () => {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "{not-json");
    expect(readCookieConsent()).toBeNull();
  });
});
