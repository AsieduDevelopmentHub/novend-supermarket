import { hasExplicitLogout } from "@/lib/auth/logout-flag";
import {
  ensureActiveOfflineSession,
  hasOfflineSession,
  listOfflineSessions,
  readOfflineSession,
  type OfflineSessionHint,
} from "@/lib/offline/session";
import { readPlatformOfflineSession } from "@/lib/offline/platform-cache";

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

/**
 * Escape a Next error boundary. Always hard-navigate — `reset()` alone often
 * re-throws immediately (especially on `/platform` after a render-phase update),
 * which made Try again / Go to dashboard look dead.
 */
export function resumeOfflineShellToDashboard(reset?: () => void): void {
  void reset;
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
    window.location.replace("/dashboard?fromBoot=1&recover=1");
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
