/**
 * Land on `/login?signedOut=1` after sign-out.
 *
 * Capacitor offline: append `fromBoot=1` so the SW serves the precached login
 * document immediately. Online Cap must **not** use fromBoot — that forced
 * cache-first of a possibly empty/poisoned shell and hung leave.
 *
 * Electron online: hard `location.replace` (no trampoline).
 * Electron offline / false-online leave: `reloadAuthShell` trampoline — HTTPS
 * loadURL fails offline (electron#35112); offline-boot skips appending
 * `fromBoot` when entry already has `signedOut=1`.
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

/** Cap offline only — SW cache-first for dead-radio tills. */
const LOGIN_AFTER_SIGN_OUT_CAP_OFFLINE = `${LOGIN_AFTER_SIGN_OUT_PATH}&fromBoot=1`;

/** Escape / fresh leave — bypasses sticky SW matches when Try again is pressed. */
const LOGIN_AFTER_SIGN_OUT_FRESH = `${LOGIN_AFTER_SIGN_OUT_PATH}&novendFresh=1`;

/** If replace stalls, force leave so “Signing out…” cannot stick. */
const HARD_LEAVE_FALLBACK_MS = 1600;

function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Prefer trampoline when Electron cannot load HTTPS (true offline). */
function shouldUseElectronTrampoline(): boolean {
  return isElectron() && isBrowserOffline();
}

export function loginAfterSignOutHref(options?: { fresh?: boolean }): string {
  if (options?.fresh) {
    // Offline: never force novendFresh — network-first hangs on dead radio.
    if (typeof window !== "undefined" && isBrowserOffline()) {
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
    if (shouldUseElectronTrampoline()) {
      const ok = await electronTrampolineLeave(loginAfterSignOutHref());
      scheduleHardLeaveFallback({ preferTrampoline: true });
      if (!ok) hardLeaveToLogin();
      return;
    }
    hardLeaveToLogin();
    // If radio dies mid-leave, escalate to trampoline on the fallback tick.
    scheduleHardLeaveFallback({ preferTrampoline: true });
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
  }

  hardLeaveToLogin();
}

/**
 * Escape hatch from a stuck Signing out splash.
 * Online: assign with novendFresh. Offline Electron: trampoline (not network-first).
 */
export function forceLeaveToLoginAfterSignOut(): void {
  if (typeof window === "undefined") return;
  prepareHardNavigation();
  if (shouldUseElectronTrampoline()) {
    void (async () => {
      const ok = await electronTrampolineLeave(loginAfterSignOutHref());
      if (!ok) hardLeaveToLogin({ assign: true });
    })();
    return;
  }
  hardLeaveToLogin({ fresh: true, assign: true });
}
