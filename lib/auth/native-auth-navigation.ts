/**
 * Land on `/login?signedOut=1` after sign-out.
 *
 * Capacitor: stay on the hosted origin so the service worker can serve the
 * precached login document while offline. Bouncing through
 * `https://localhost/?entry=…` leaves the SW and reloads the remote URL over
 * the network → Android “webpage not available”. Cap hard-leave keeps
 * `fromBoot=1` for SW cache-first.
 *
 * Electron (online): prefer the local offline-boot trampoline (same as cold
 * start). Never await that IPC forever — when the radio drops mid-shift, a hung
 * `reloadAuthShell` used to trap the app on “Signing out…”.
 *
 * Electron (offline): skip the trampoline and hard-leave immediately. Do **not**
 * append `fromBoot=1` — that flag forces SW cache-first, and a poisoned `/login`
 * cache (followed session 302 → dashboard HTML) painted AppSplash forever.
 *
 * Browser (online): navigate to `?signedOut=1` only — same no-`fromBoot` rule.
 */

import { getElectronBridge, isCapacitor, isElectron } from "@novend/hardware";
import {
  capacitorBootUrl,
  CAPACITOR_BOOT_ORIGIN,
  LOGIN_AFTER_SIGN_OUT_PATH,
} from "@/lib/auth/capacitor-boot";
import { hasExplicitLogout } from "@/lib/auth/logout-flag";
import { prepareHardNavigation } from "@/lib/auth/redirect-after-login";

type AuthShellBridge = {
  reloadAuthShell?: (entry?: string) => Promise<{ ok: boolean; message?: string }>;
};

/** Capacitor cold-boot marker — SW cache-first for offline tills. */
const LOGIN_AFTER_SIGN_OUT_CAPACITOR = `${LOGIN_AFTER_SIGN_OUT_PATH}&fromBoot=1`;

/** If trampoline / replace stalls, force leave so “Signing out…” cannot stick. */
const HARD_LEAVE_FALLBACK_MS = 1600;

function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function loginAfterSignOutHref(): string {
  if (typeof window !== "undefined" && isCapacitor()) {
    return LOGIN_AFTER_SIGN_OUT_CAPACITOR;
  }
  // Electron + browser: never fromBoot on signed-out leave (poisoned login cache).
  return LOGIN_AFTER_SIGN_OUT_PATH;
}

function hardLeaveToLogin(): void {
  if (typeof window === "undefined") return;
  prepareHardNavigation();
  const href = loginAfterSignOutHref();
  try {
    window.location.replace(href);
  } catch {
    window.location.href = href;
  }
}

function scheduleHardLeaveFallback(): void {
  window.setTimeout(() => {
    if (!hasExplicitLogout()) return;
    if (window.location.pathname.startsWith("/login")) return;
    hardLeaveToLogin();
  }, HARD_LEAVE_FALLBACK_MS);
}

/**
 * Kick navigation to login. Resolves quickly — does not wait for the next
 * document to finish loading (that can hang offline and strand the splash).
 */
export async function navigateToLoginAfterSignOut(): Promise<void> {
  prepareHardNavigation();
  if (typeof window === "undefined") return;

  if (isElectron()) {
    // Dead radio: trampoline → hosted /login fails and strands Signing out.
    if (isBrowserOffline()) {
      hardLeaveToLogin();
      scheduleHardLeaveFallback();
      return;
    }

    const bridge = getElectronBridge<AuthShellBridge>();
    if (bridge?.reloadAuthShell) {
      void bridge
        .reloadAuthShell(LOGIN_AFTER_SIGN_OUT_PATH)
        .then((result) => {
          if (!result?.ok) hardLeaveToLogin();
        })
        .catch(() => {
          hardLeaveToLogin();
        });
      scheduleHardLeaveFallback();
      return;
    }
  }

  if (isCapacitor()) {
    const onBootOrigin =
      window.location.origin === CAPACITOR_BOOT_ORIGIN || window.location.hostname === "localhost";
    if (onBootOrigin) {
      window.location.replace(capacitorBootUrl(LOGIN_AFTER_SIGN_OUT_PATH));
      scheduleHardLeaveFallback();
      return;
    }
  }

  hardLeaveToLogin();
}
