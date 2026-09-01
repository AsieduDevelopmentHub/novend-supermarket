import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { clearLastRoute } from "@/lib/auth/last-route";
import { markExplicitLogout } from "@/lib/auth/logout-flag";
import { clearUserDeviceState } from "@/lib/auth/clear-user-device-state";
import { prepareHardNavigation } from "@/lib/auth/redirect-after-login";
import { clearPlatformOfflineSession } from "@/lib/offline/platform-cache";
import { deleteBoundOfflineReplica } from "@/lib/offline/db";
import { clearOfflineSession } from "@/lib/offline/session";
import { clearCartDraft } from "@/lib/sales/cart-draft";

type SignOutOptions = {
  signOut: () => Promise<void>;
  /** Kept for callers; sign-out always hard-navigates so `/login?signedOut=1` cannot be stripped. */
  router: AppRouterInstance;
  clearPresence?: () => Promise<unknown>;
};

/**
 * End the session and land on a clean login screen.
 * Await Dexie replica delete *before* navigation so the next user cannot
 * inherit the previous replica, last route, or splash-cover loop.
 *
 * Always `location.replace` so the signed-out query string stays on `/login`.
 * Soft Next navigation extra-fetches `/login` without that query and remounts
 * the session gate on the splash.
 */
export async function signOutAndRedirect({
  signOut,
  clearPresence,
}: SignOutOptions): Promise<void> {
  markExplicitLogout();
  try {
    await deleteBoundOfflineReplica();
  } catch {
    /* IndexedDB unavailable */
  }
  clearOfflineSession();
  clearPlatformOfflineSession();
  clearLastRoute();
  clearCartDraft();
  clearUserDeviceState();
  void clearPresence?.().catch(() => {
    /* best-effort */
  });

  try {
    await signOut();
  } finally {
    if (typeof window === "undefined") return;
    prepareHardNavigation();
    window.location.replace("/login?signedOut=1");
  }
}
