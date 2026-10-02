/**
 * Recover Cap/Electron when offline sign-out (or a mid-deploy chunk miss)
 * lands in a Next error boundary instead of `/login`.
 */

import { hasExplicitLogout } from "@/lib/auth/logout-flag";
import { navigateToLoginAfterSignOut } from "@/lib/auth/native-auth-navigation";
import { LOGIN_AFTER_SIGN_OUT_PATH } from "@/lib/auth/capacitor-boot";
import { prepareHardNavigation } from "@/lib/auth/redirect-after-login";
import { hasOfflineSession } from "@/lib/offline/session";

const CHUNK_RECOVERY_KEY = "novend.chunkRecovery.at";
const CHUNK_RECOVERY_COOLDOWN_MS = 30_000;

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
    lower.includes("loading css chunk") ||
    lower.includes("module factory is not available") ||
    lower.includes("was instantiated because it was required from module")
  );
}

/** True when React threw because something else already removed a DOM node. */
export function isReactDomDetachError(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : String(error ?? "");
  const lower = text.toLowerCase();
  return (
    lower.includes("removechild") ||
    lower.includes("insertbefore") ||
    (lower.includes("notfounderror") && lower.includes("node")) ||
    lower.includes("the node to be removed is not a child")
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

/** Claim a single automatic refresh for a stale Next client build. */
export function shouldAutoRecoverChunkFailure(error: unknown): boolean {
  if (!isChunkLoadError(error)) return false;
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (!navigator.onLine) return false;
  const now = Date.now();
  try {
    const previous = Number(window.sessionStorage.getItem(CHUNK_RECOVERY_KEY) ?? "0");
    if (Number.isFinite(previous) && now - previous < CHUNK_RECOVERY_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(now));
  } catch {
    /* Reloading is still safer than leaving a framework error visible. */
  }
  return true;
}

/** Reload without cache-first boot markers so old and new Next builds cannot mix. */
export function recoverFromChunkLoadFailure(): void {
  if (typeof window === "undefined") return;
  const target = new URL(window.location.href);
  target.searchParams.delete("fromBoot");
  target.searchParams.delete("fromLogin");
  target.searchParams.delete("recover");
  target.searchParams.set("novendFresh", Date.now().toString(36));
  prepareHardNavigation();
  window.location.replace(`${target.pathname}${target.search}${target.hash}`);
}
