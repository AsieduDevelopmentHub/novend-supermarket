/**
 * Land on `/login?signedOut=1` after sign-out.
 *
 * Capacitor offline: append `fromBoot=1` so the SW serves the precached login
 * document immediately. Online Cap must **not** use fromBoot on the happy path —
 * that forced cache-first of a possibly empty/poisoned shell.
 *
 * Electron: always use `reloadAuthShell` trampoline. Online→offline flaps still
 * report `navigator.onLine === true` while HTTPS `location.replace` hangs
 * (electron#35112), which stranded “Signing out…”. The trampoline loads local
 * offline-boot then the cached login document.
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
import { getDesktopBridge } from "@/lib/desktop";

/** Cap offline / escape — SW cache-first for dead-radio tills. */
const LOGIN_AFTER_SIGN_OUT_CAP_OFFLINE = `${LOGIN_AFTER_SIGN_OUT_PATH}&fromBoot=1`;

/** Browser escape only — bypasses sticky SW matches. Never use offline (hangs). */
const LOGIN_AFTER_SIGN_OUT_FRESH = `${LOGIN_AFTER_SIGN_OUT_PATH}&novendFresh=1`;

/** If replace stalls, force leave so “Signing out…” cannot stick. */
const HARD_LEAVE_FALLBACK_MS = 900;

function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Electron always leaves through the local trampoline. Relying on
 * `navigator.onLine === false` missed online→offline sign-out and left the
 * Signing out splash with dead CTAs.
 */
function shouldUseElectronTrampoline(): boolean {
  return isElectron();
}

export function loginAfterSignOutHref(options?: { fresh?: boolean }): string {
  if (options?.fresh) {
    // Native / offline: never force novendFresh — network-first hangs on dead radio.
    if (typeof window !== "undefined" && (isBrowserOffline() || isElectron() || isCapacitor())) {
      if (isCapacitor()) return LOGIN_AFTER_SIGN_OUT_CAP_OFFLINE;
      return LOGIN_AFTER_SIGN_OUT_PATH;
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

async function electronTrampolineLeave(entry: string): Promise<boolean> {
  const bridge = getDesktopBridge();
  if (!bridge?.reloadAuthShell) return false;
  try {
    const result = await bridge.reloadAuthShell(entry);
    return Boolean(result?.ok);
  } catch {
    return false;
  }
}

function scheduleHardLeaveFallback(options?: { preferTrampoline?: boolean }): void {
  window.setTimeout(() => {
    if (!hasExplicitLogout()) return;
    if (window.location.pathname.startsWith("/login")) return;
    if (options?.preferTrampoline || shouldUseElectronTrampoline()) {
      void (async () => {
        const ok = await electronTrampolineLeave(loginAfterSignOutHref());
        if (!ok) hardLeaveToLogin({ assign: true });
      })();
      return;
    }
    if (isCapacitor()) {
      hardLeaveToLogin({ assign: true, fresh: true });
      return;
    }
    hardLeaveToLogin({ assign: true });
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
    const entry = loginAfterSignOutHref();
    const ok = await electronTrampolineLeave(entry);
    scheduleHardLeaveFallback({ preferTrampoline: true });
    if (!ok) hardLeaveToLogin({ assign: true });
    return;
  }

  if (isCapacitor()) {
    const onBootOrigin =
      window.location.origin === CAPACITOR_BOOT_ORIGIN || window.location.hostname === "localhost";
    if (onBootOrigin) {
      window.location.replace(capacitorBootUrl(loginAfterSignOutHref()));
      scheduleHardLeaveFallback();
      return;
    }
    // False-online Cap: prefer cached login (fromBoot) over a hung network leave.
    if (isBrowserOffline()) {
      hardLeaveToLogin();
      scheduleHardLeaveFallback();
      return;
    }
  }

  hardLeaveToLogin();
  scheduleHardLeaveFallback();
}

/**
 * Escape hatch from a stuck Signing out splash.
 * Electron: trampoline only (never novendFresh). Cap offline/false-online: fromBoot.
 * Browser online: novendFresh assign.
 */
export function forceLeaveToLoginAfterSignOut(): void {
  if (typeof window === "undefined") return;
  prepareHardNavigation();

  if (isElectron()) {
    void (async () => {
      const ok = await electronTrampolineLeave(loginAfterSignOutHref());
      if (!ok) hardLeaveToLogin({ assign: true });
      // Second tick if still stranded on the splash document.
      scheduleHardLeaveFallback({ preferTrampoline: true });
    })();
    return;
  }

  if (isCapacitor()) {
    const onBootOrigin =
      window.location.origin === CAPACITOR_BOOT_ORIGIN || window.location.hostname === "localhost";
    if (onBootOrigin) {
      // Boot appends fromBoot itself. Passing it in the entry made boot
      // treat the leave as a normal open and load the dashboard again.
      window.location.assign(capacitorBootUrl(LOGIN_AFTER_SIGN_OUT_PATH));
      return;
    }
    const href = LOGIN_AFTER_SIGN_OUT_CAP_OFFLINE;
    try {
      window.location.assign(href);
    } catch {
      window.location.href = href;
    }
    return;
  }

  hardLeaveToLogin({ fresh: true, assign: true });
}
