import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { clearLastRoute } from "@/lib/auth/last-route";
import { markExplicitLogout } from "@/lib/auth/logout-flag";
import { clearUserDeviceState } from "@/lib/auth/clear-user-device-state";
import { navigateToLoginAfterSignOut } from "@/lib/auth/native-auth-navigation";
import { clearPlatformOfflineSession } from "@/lib/offline/platform-cache";
import { deleteBoundOfflineReplica } from "@/lib/offline/db";
import { clearOfflineSession } from "@/lib/offline/session";
import { clearCartDraft } from "@/lib/sales/cart-draft";
import { clearCustomerDisplaySnapshot } from "@/lib/sales/customer-display";

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
 * Always hard-navigate so the signed-out query string stays on `/login`.
 * Native shells use the offline boot trampoline when the network is down.
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
  clearCustomerDisplaySnapshot();
  clearUserDeviceState();
  void clearPresence?.().catch(() => {
    /* best-effort */
  });

  try {
    await signOut();
  } finally {
    await navigateToLoginAfterSignOut();
  }
}
