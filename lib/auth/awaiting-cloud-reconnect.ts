import { hasExplicitLogout } from "@/lib/auth/logout-flag";
import {
  hasOfflineSession,
  readOfflineSession,
  type OfflineSessionHint,
} from "@/lib/offline/session";

/**
 * True when the till has a local offline shell but no Convex JWT.
 * Do **not** gate on Convex `isLoading` — that flicker is what briefly
 * opened Connect-to-cloud then kicked cashiers to `/login` on reconnect.
 */
export function isAwaitingCloudReconnect(input: {
  isAuthenticated: boolean;
  sessionHint?: OfflineSessionHint | null;
}): boolean {
  if (input.isAuthenticated) return false;
  if (hasExplicitLogout()) return false;
  if (input.sessionHint) return true;
  if (typeof window === "undefined") return false;
  return hasOfflineSession() || readOfflineSession() != null;
}
