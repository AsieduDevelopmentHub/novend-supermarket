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
  const [ready, setReady] = useState(() => !enabled);
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
        setVisible(false);
      } else {
        setVisible(true);
      }
      setReady(true);
    });

    function onPreferences(event: Event) {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
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
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center p-3 sm:p-5"
    >
      <div className="landing-shadow-card pointer-events-auto w-full max-w-xl rounded-2xl border border-slate-200/90 bg-white p-4 text-[#111827] sm:p-5">
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
            <Cookie className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h2 id="cookie-consent-title" className="text-sm font-semibold tracking-tight sm:text-base">
                Cookies on Novend
              </h2>
              <p id="cookie-consent-desc" className="mt-1 text-sm leading-relaxed text-slate-600">
                We use strictly necessary cookies to run the site and sign-in. Optional cookies help
                with preferences and measuring how public pages perform. See our{" "}
                <Link href="/cookies" className="text-primary font-medium underline-offset-2 hover:underline">
                  Cookie Policy
                </Link>
                .
              </p>
            </div>

            {customize ? (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex items-start gap-3">
                  <Checkbox id="cookie-necessary" checked disabled className="mt-0.5" />
                  <div>
                    <Label htmlFor="cookie-necessary" className="text-sm font-medium text-[#111827]">
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
                    <Label htmlFor="cookie-preferences" className="text-sm font-medium text-[#111827]">
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
                    <Label htmlFor="cookie-analytics" className="text-sm font-medium text-[#111827]">
                      Analytics
                    </Label>
                    <p className="text-xs leading-relaxed text-slate-500">
                      Help us understand public-page usage. Off by default until you opt in.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                type="button"
                className="landing-shadow-cta-primary min-h-10"
                onClick={acceptAll}
              >
                Accept all
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-10 border-slate-200 bg-white"
                onClick={rejectNonEssential}
              >
                Reject non-essential
              </Button>
              {customize ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-10"
                  onClick={saveCustom}
                >
                  Save choices
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-10 text-slate-700"
                  onClick={() => setCustomize(true)}
                >
                  Customize
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
