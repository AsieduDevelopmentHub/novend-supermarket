"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  COOKIE_PREFERENCES_EVENT,
  readCookieConsent,
  writeCookieConsent,
  type CookiePreferencesDetail,
} from "@/lib/cookies/consent";

type Props = {
  /** Hide on Cap/Electron/PWA-embedded chrome — those shells are app, not marketing. */
  enabled?: boolean;
};

/**
 * Cookie consent for public marketing surfaces.
 * Necessary cookies stay on; preferences and analytics are opt-in.
 */
export function CookieConsentBanner({ enabled = true }: Props) {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [preferences, setPreferences] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const existing = readCookieConsent();
      if (existing) {
        setPreferences(existing.preferences);
        setAnalytics(existing.analytics);
        setCustomize(false);
        setVisible(false);
      } else {
        setVisible(true);
      }
      setReady(true);
    });

    function onPreferences(event: Event) {
      const detail = (event as CustomEvent<CookiePreferencesDetail>).detail;
      if (detail?.saved) {
        const current = readCookieConsent();
        if (current) {
          setPreferences(current.preferences);
          setAnalytics(current.analytics);
          setCustomize(false);
          setVisible(false);
        }
        return;
      }
      if (detail?.open) {
        const current = readCookieConsent();
        setPreferences(current?.preferences ?? false);
        setAnalytics(current?.analytics ?? false);
        setCustomize(true);
        setVisible(true);
      }
    }

    window.addEventListener(COOKIE_PREFERENCES_EVENT, onPreferences);
    return () => {
      cancelled = true;
      window.removeEventListener(COOKIE_PREFERENCES_EVENT, onPreferences);
    };
  }, [enabled]);

  function persist(next: { preferences: boolean; analytics: boolean }) {
    writeCookieConsent(next);
    setPreferences(next.preferences);
    setAnalytics(next.analytics);
    setCustomize(false);
    setVisible(false);
  }

  function acceptAll() {
    persist({ preferences: true, analytics: true });
  }

  function rejectNonEssential() {
    persist({ preferences: false, analytics: false });
  }

  function saveCustom() {
    persist({ preferences, analytics });
  }

  if (!enabled || !ready || !visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-end p-3 sm:p-4"
    >
      <div className="pointer-events-auto w-full max-w-sm rounded-xl border border-slate-200/90 bg-white/95 p-3.5 text-[#0F172A] shadow-[0_12px_40px_-24px_rgba(15,23,42,0.35)] backdrop-blur-sm sm:p-4">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Cookie className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-2.5">
            <div>
              <h2 id="cookie-consent-title" className="text-sm font-semibold tracking-tight">
                Cookies
              </h2>
              <p id="cookie-consent-desc" className="mt-1 text-xs leading-relaxed text-slate-600">
                Necessary cookies keep the site and sign-in working. Optional cookies are for
                preferences and analytics.{" "}
                <Link
                  href="/cookies"
                  className="text-primary font-medium underline-offset-2 hover:underline"
                >
                  Policy
                </Link>
              </p>
            </div>

            {customize ? (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex items-start gap-3">
                  <Checkbox id="cookie-necessary" checked disabled className="mt-0.5" />
                  <div>
                    <Label
                      htmlFor="cookie-necessary"
                      className="text-sm font-medium text-[#111827]"
                    >
                      Strictly necessary
                    </Label>
                    <p className="text-xs leading-relaxed text-slate-500">
                      Always on — security, session, and core site functions.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="cookie-preferences"
                    checked={preferences}
                    onCheckedChange={(value) => setPreferences(value === true)}
                    className="mt-0.5"
                  />
                  <div>
                    <Label
                      htmlFor="cookie-preferences"
                      className="text-sm font-medium text-[#111827]"
                    >
                      Preferences
                    </Label>
                    <p className="text-xs leading-relaxed text-slate-500">
                      Remember non-essential UI choices on marketing pages.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="cookie-analytics"
                    checked={analytics}
                    onCheckedChange={(value) => setAnalytics(value === true)}
                    className="mt-0.5"
                  />
                  <div>
                    <Label
                      htmlFor="cookie-analytics"
                      className="text-sm font-medium text-[#111827]"
                    >
                      Analytics
                    </Label>
                    <p className="text-xs leading-relaxed text-slate-500">
                      Help us understand public-page usage. Off by default until you opt in.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-1.5">
              <Button type="button" size="sm" className="h-9" onClick={acceptAll}>
                Accept
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 border-slate-200 bg-white"
                onClick={rejectNonEssential}
              >
                Reject
              </Button>
              {customize ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-9"
                  onClick={saveCustom}
                >
                  Save
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 text-slate-700"
                  onClick={() => setCustomize(true)}
                >
                  Options
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
