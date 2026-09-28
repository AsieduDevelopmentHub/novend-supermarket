/**
 * Recover Cap/Electron when offline sign-out (or a mid-deploy chunk miss)
 * lands in a Next error boundary instead of `/login`.
 */

import { hasExplicitLogout } from "@/lib/auth/logout-flag";
import { navigateToLoginAfterSignOut } from "@/lib/auth/native-auth-navigation";
import { LOGIN_AFTER_SIGN_OUT_PATH } from "@/lib/auth/capacitor-boot";
import { prepareHardNavigation } from "@/lib/auth/redirect-after-login";
import { hasOfflineSession } from "@/lib/offline/session";

export function isChunkLoadError(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : String(error ?? "");
  const lower = text.toLowerCase();
  return (
    lower.includes("chunkloaderror") ||
    lower.includes("failed to load chunk") ||
    lower.includes("loading chunk") ||
    lower.includes("loading css chunk")
  );
}

/** True when the till should leave the error sheet for a clean sign-in screen. */
export function shouldRecoverToLogin(error: unknown): boolean {
  if (typeof window === "undefined") return false;
  if (hasExplicitLogout()) return true;
  // Offline / reconnect shells must stay in the POS — CTAs that bounce to
  // /login drop queued work and look like a crash after the radio returns.
  if (hasOfflineSession()) return false;
  if (window.location.pathname === "/login" || window.location.pathname === "/signup") {
    return isChunkLoadError(error);
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false && isChunkLoadError(error)) {
    return true;
  }
  return false;
}

/**
 * Hard-leave an error boundary for `/login?signedOut=1`.
 * Prefer the Electron/Cap trampoline so offline Cache Storage can serve login.
 */
export async function recoverToLoginAfterFailure(): Promise<void> {
  try {
    await navigateToLoginAfterSignOut();
  } catch {
    prepareHardNavigation();
    window.location.replace(LOGIN_AFTER_SIGN_OUT_PATH);
  }
}
