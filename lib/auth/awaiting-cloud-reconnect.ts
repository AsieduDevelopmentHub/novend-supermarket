import { hasExplicitLogout } from "@/lib/auth/logout-flag";
import {
  ensureActiveOfflineSession,
  hasOfflineSession,
  listOfflineSessions,
  readOfflineSession,
  type OfflineSessionHint,
} from "@/lib/offline/session";

/**
 * True when the till has a local offline shell but no Convex JWT.
 * Pure check only — never write storage here (layout/banner effects restore
 * the active hint). Gating on Convex `isLoading` briefly opened Connect-to-cloud
 * then kicked cashiers to `/login` on reconnect.
 */
export function isAwaitingCloudReconnect(input: {
  isAuthenticated: boolean;
  sessionHint?: OfflineSessionHint | null;
}): boolean {
  if (input.isAuthenticated) return false;
  if (hasExplicitLogout()) return false;
  if (input.sessionHint) return true;
  if (typeof window === "undefined") return false;
  return (
    hasOfflineSession() ||
    readOfflineSession() != null ||
    listOfflineSessions().length > 0
  );
}

/** Soft recovery target when an error boundary fires with a local workspace. */
export function resumeOfflineShellToDashboard(reset?: () => void): void {
  if (typeof window === "undefined") return;
  if (hasExplicitLogout()) {
    reset?.();
    window.location.replace("/login?signedOut=1");
    return;
  }
  const session = readOfflineSession() ?? ensureActiveOfflineSession();
  if (!session) {
    reset?.();
    return;
  }

  // A hard recovery through fromBoot is cache-first and escapes a poisoned
  // Next error boundary without asking middleware for a cloud session.
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    window.location.replace("/dashboard?fromBoot=1&recover=1");
    return;
  }

  window.history.replaceState({}, "", "/dashboard");
  window.dispatchEvent(new PopStateEvent("popstate"));
  queueMicrotask(() => reset?.());
}
