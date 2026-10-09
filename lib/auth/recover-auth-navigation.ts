/**
 * Recover Cap/Electron when offline sign-out (or a mid-deploy chunk miss)
 * lands in a Next error boundary instead of `/login`.
 */

import { isStaleClientError } from "@/lib/errors";
import { hasExplicitLogout } from "@/lib/auth/logout-flag";
import { navigateToLoginAfterSignOut } from "@/lib/auth/native-auth-navigation";
import { LOGIN_AFTER_SIGN_OUT_PATH } from "@/lib/auth/capacitor-boot";
import { prepareHardNavigation } from "@/lib/auth/redirect-after-login";
import { hasOfflineSession } from "@/lib/offline/session";

const CHUNK_RECOVERY_KEY = "novend.chunkRecovery.at";
const CHUNK_RECOVERY_COOLDOWN_MS = 12_000;
const SW_RELOAD_KEY = "novend.swReload.at";
const SW_RELOAD_COOLDOWN_MS = 15_000;

function collectErrorText(error: unknown): string {
  if (error == null) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    const cause =
      "cause" in error && error.cause != null ? ` ${collectErrorText(error.cause)}` : "";
    const digest =
      "digest" in error && typeof (error as { digest?: unknown }).digest === "string"
        ? ` ${(error as { digest: string }).digest}`
        : "";
    const stack = error.stack ? ` ${error.stack}` : "";
    return `${error.name} ${error.message}${cause}${digest}${stack}`;
  }
  if (typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

export function isChunkLoadError(error: unknown): boolean {
  const lower = collectErrorText(error).toLowerCase();
  return (
    lower.includes("chunkloaderror") ||
    lower.includes("failed to load chunk") ||
    lower.includes("loading chunk") ||
    lower.includes("loading css chunk") ||
    lower.includes("module factory is not available") ||
    lower.includes("was instantiated because it was required from module") ||
    lower.includes("deleted in an hmr update")
  );
}

/** True when React threw because something else already removed a DOM node. */
export function isReactDomDetachError(error: unknown): boolean {
  const lower = collectErrorText(error).toLowerCase();
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

function claimClientRecoverySlot(): boolean {
  if (typeof window === "undefined") return false;
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

/** Claim a single automatic refresh for a stale Next client build. */
export function shouldAutoRecoverChunkFailure(error: unknown): boolean {
  if (!isChunkLoadError(error)) return false;
  if (typeof navigator === "undefined") return false;
  // Reconnect often flickers offline→online; still refresh once so mixed builds clear.
  return claimClientRecoverySlot();
}

/** One refresh when the open page still calls a server action the new deploy removed. */
export function shouldAutoRecoverStaleClient(error: unknown): boolean {
  if (!isStaleClientError(error)) return false;
  if (typeof window === "undefined") return false;
  // Login/signup stuck on a stale action id must refresh even if a chunk recovery
  // just ran — otherwise the raw Server Action toast blocks the first sign-in.
  const onAuth =
    window.location.pathname === "/login" || window.location.pathname === "/signup";
  if (onAuth) {
    const now = Date.now();
    try {
      const previous = Number(window.sessionStorage.getItem(CHUNK_RECOVERY_KEY) ?? "0");
      if (Number.isFinite(previous) && now - previous < 3_000) return false;
      window.sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(now));
    } catch {
      /* Reloading is still safer than leaving the raw action id toast. */
    }
    return true;
  }
  return claimClientRecoverySlot();
}

/** Reload once for a missing server action. Returns false when the cooldown already fired. */
export function recoverStaleClient(error: unknown): boolean {
  if (!shouldAutoRecoverStaleClient(error)) return false;
  // Drop cached auth shells so the next load cannot reuse the dead action id.
  try {
    void caches?.keys?.().then(async (keys) => {
      await Promise.all(
        keys
          .filter((key) => key.startsWith("novend-pos"))
          .map(async (key) => {
            const cache = await caches.open(key);
            await cache.delete("/login");
            await cache.delete("/signup");
          }),
      );
    });
  } catch {
    /* novendFresh still forces network on the next navigation */
  }
  recoverFromChunkLoadFailure();
  return true;
}

/** One-shot full reload after a new service worker claims the page. */
export function shouldReloadForServiceWorkerUpdate(): boolean {
  if (typeof window === "undefined") return false;
  const now = Date.now();
  try {
    const previous = Number(window.sessionStorage.getItem(SW_RELOAD_KEY) ?? "0");
    if (Number.isFinite(previous) && now - previous < SW_RELOAD_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(SW_RELOAD_KEY, String(now));
  } catch {
    /* continue */
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
  // Presence (any value) is enough for the service worker — see sw.js freshLeave.
  target.searchParams.set("novendFresh", Date.now().toString(36));
  prepareHardNavigation();
  // Ask waiting workers to activate so the next document is the new generation.
  try {
    void navigator.serviceWorker?.getRegistration()?.then((registration) => {
      void registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
      void registration?.update();
    });
  } catch {
    /* ignore */
  }
  window.location.replace(`${target.pathname}${target.search}${target.hash}`);
}
