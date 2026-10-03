import { hasExplicitLogout } from "@/lib/auth/logout-flag";
import { isOnlineSessionWarm } from "@/lib/auth/redirect-after-login";
import {
  ensureActiveOfflineSession,
  hasOfflineSession,
  listOfflineSessions,
  readOfflineSession,
  type OfflineSessionHint,
} from "@/lib/offline/session";
import { readPlatformOfflineSession } from "@/lib/offline/platform-cache";

const LOCAL_ONLY_CLOUD_USER_KEY = "novend.cloudReconnect.localOnlyUserId";
/** Middleware-readable latch so Continue locally survives JWT clear without a /login 302. */
export const LOCAL_ONLY_CLOUD_COOKIE = "novend_local_only";
export const LOCAL_ONLY_CLOUD_USER_EVENT = "novend:local-only-cloud-user-changed";

function writeLocalOnlyCookie(userId: string): void {
  if (typeof document === "undefined" || !userId) return;
  try {
    // Path=/ so proxy.ts sees it on /dashboard RSC refetches after signOut.
    document.cookie = `${LOCAL_ONLY_CLOUD_COOKIE}=${encodeURIComponent(userId)}; path=/; SameSite=Lax; Max-Age=86400`;
  } catch {
    /* ignore */
  }
}

function clearLocalOnlyCookie(): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${LOCAL_ONLY_CLOUD_COOKIE}=; path=/; SameSite=Lax; Max-Age=0`;
  } catch {
    /* ignore */
  }
}

/** Session-scoped choice to keep working locally while the radio is online. */
export function readLocalOnlyCloudUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(LOCAL_ONLY_CLOUD_USER_KEY);
  } catch {
    return null;
  }
}

export function rememberLocalOnlyCloudUser(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.sessionStorage.setItem(LOCAL_ONLY_CLOUD_USER_KEY, userId);
  } catch {
    /* private mode */
  }
  writeLocalOnlyCookie(userId);
  window.dispatchEvent(new Event(LOCAL_ONLY_CLOUD_USER_EVENT));
}

export function clearLocalOnlyCloudUser(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(LOCAL_ONLY_CLOUD_USER_KEY);
  } catch {
    /* private mode */
  }
  clearLocalOnlyCookie();
  window.dispatchEvent(new Event(LOCAL_ONLY_CLOUD_USER_EVENT));
}

/**
 * True when the till has a local offline shell but no Convex JWT.
 * Pure check only — never write storage here (layout/banner effects restore
 * the active hint). Gating on Convex `isLoading` briefly opened Connect-to-cloud
 * then kicked cashiers to `/login` on reconnect.
 *
 * Online password login sets a warm window — that is not “awaiting reconnect”.
 */
export function isAwaitingCloudReconnect(input: {
  isAuthenticated: boolean;
  sessionHint?: OfflineSessionHint | null;
}): boolean {
  if (input.isAuthenticated) return false;
  if (hasExplicitLogout()) return false;
  if (isOnlineSessionWarm()) return false;
  if (input.sessionHint) return true;
  if (typeof window === "undefined") return false;
  return (
    hasOfflineSession() ||
    readOfflineSession() != null ||
    listOfflineSessions().length > 0
  );
}

/**
 * Escape a Next error boundary. Always hard-navigate — `reset()` alone often
 * re-throws immediately (especially on `/platform` after a render-phase update),
 * which made Try again / Go to dashboard look dead.
 */
export function resumeOfflineShellToDashboard(reset?: () => void): void {
  if (typeof window === "undefined") return;
  if (hasExplicitLogout()) {
    window.location.replace("/login?signedOut=1");
    return;
  }

  const platform = readPlatformOfflineSession();
  if (platform) {
    window.location.replace("/platform?fromBoot=1&recover=1");
    return;
  }

  const session = readOfflineSession() ?? ensureActiveOfflineSession();
  if (session) {
    rememberLocalOnlyCloudUser(session.userId);
    const target = "/dashboard?fromBoot=1&recover=1";
    if (typeof navigator !== "undefined" && navigator.onLine) {
      // An online hard navigation without a JWT is correctly redirected by the
      // server to /login. Reset in-place so the client-only local shell survives.
      window.history.replaceState({}, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
      reset?.();
      return;
    }
    window.location.replace(target);
    return;
  }

  // No local shell — still leave the poisoned tree (reset-only was a no-op loop).
  const here = window.location.pathname;
  if (here.startsWith("/platform")) {
    window.location.replace("/platform?recover=1");
    return;
  }
  if (here.startsWith("/login") || here.startsWith("/signup")) {
    window.location.replace("/login");
    return;
  }
  window.location.replace("/dashboard?recover=1");
}
