/**
 * Land on `/login?signedOut=1` after sign-out.
 *
 * Capacitor offline: append `fromBoot=1` so the SW serves the precached login
 * document immediately. Online Cap/Electron must **not** use fromBoot — that
 * forced cache-first of a possibly empty/poisoned shell and hung leave.
 *
 * Electron: never use the offline-boot trampoline on sign-out. It re-appends
 * fromBoot and returns ok before navigation finishes, trapping “Signing out…”.
 *
 * Browser: `?signedOut=1` only.
 */

import { isCapacitor, isElectron } from "@novend/hardware";
import {
  capacitorBootUrl,
  CAPACITOR_BOOT_ORIGIN,
  LOGIN_AFTER_SIGN_OUT_PATH,
} from "@/lib/auth/capacitor-boot";
import { hasExplicitLogout } from "@/lib/auth/logout-flag";
import { prepareHardNavigation } from "@/lib/auth/redirect-after-login";

/** Cap offline only — SW cache-first for dead-radio tills. */
const LOGIN_AFTER_SIGN_OUT_CAP_OFFLINE = `${LOGIN_AFTER_SIGN_OUT_PATH}&fromBoot=1`;

/** Escape / fresh leave — bypasses sticky SW matches when Try again is pressed. */
const LOGIN_AFTER_SIGN_OUT_FRESH = `${LOGIN_AFTER_SIGN_OUT_PATH}&novendFresh=1`;

/** If replace stalls, force leave so “Signing out…” cannot stick. */
const HARD_LEAVE_FALLBACK_MS = 1600;

function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function loginAfterSignOutHref(options?: { fresh?: boolean }): string {
  if (options?.fresh) {
    if (typeof window !== "undefined" && isCapacitor() && isBrowserOffline()) {
      return `${LOGIN_AFTER_SIGN_OUT_CAP_OFFLINE}&novendFresh=1`;
    }
    return LOGIN_AFTER_SIGN_OUT_FRESH;
  }
  if (typeof window !== "undefined" && isCapacitor() && isBrowserOffline()) {
    return LOGIN_AFTER_SIGN_OUT_CAP_OFFLINE;
  }
  return LOGIN_AFTER_SIGN_OUT_PATH;
}

function hardLeaveToLogin(options?: { fresh?: boolean; assign?: boolean }): void {
  if (typeof window === "undefined") return;
  prepareHardNavigation();
  const href = loginAfterSignOutHref({ fresh: options?.fresh });
  try {
    if (options?.assign) {
      window.location.assign(href);
    } else {
      window.location.replace(href);
    }
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
 *
 * Electron never uses reloadAuthShell here — the trampoline re-adds fromBoot
 * and strands Signing out on dead radio.
 */
export async function navigateToLoginAfterSignOut(): Promise<void> {
  prepareHardNavigation();
  if (typeof window === "undefined") return;

  if (isElectron()) {
    hardLeaveToLogin();
    scheduleHardLeaveFallback();
    return;
  }

  if (isCapacitor()) {
    const onBootOrigin =
      window.location.origin === CAPACITOR_BOOT_ORIGIN || window.location.hostname === "localhost";
    if (onBootOrigin) {
      // Entry without fromBoot when online; offline boot URL still works — SW
      // prefers signedOut cache. Cap boot query passes the login entry through.
      window.location.replace(capacitorBootUrl(loginAfterSignOutHref()));
      scheduleHardLeaveFallback();
      return;
    }
  }

  hardLeaveToLogin();
}

/**
 * Escape hatch from a stuck Signing out splash — assign (not replace) with a
 * fresh marker so the SW does not keep serving a poisoned document.
 */
export function forceLeaveToLoginAfterSignOut(): void {
  hardLeaveToLogin({ fresh: true, assign: true });
}
