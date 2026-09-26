/**
 * End the live Convex session and land on a clean login screen.
 *
 * Per-user Dexie replicas and the offline session registry stay on device so
 * other staff (and this user) can resume offline on poor-network tills.
 * Privacy wipe / factory reset is the path that deletes replicas.
 *
 * Always hard-navigate so the signed-out query string stays on `/login`.
 * Capacitor stays on the hosted origin (SW serves cached `/login` offline).
 * Electron reloads through the local offline-boot trampoline.
 *
 * Never await Convex `signOut()` or presence clears when the radio is dead /
 * Cap / Electron — those calls hang and trap “Signing out…”.
 */

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { isCapacitor, isElectron } from "@novend/hardware";
import { clearLastRoute } from "@/lib/auth/last-route";
import { markExplicitLogout } from "@/lib/auth/logout-flag";
import { clearUserDeviceState } from "@/lib/auth/clear-user-device-state";
import { navigateToLoginAfterSignOut } from "@/lib/auth/native-auth-navigation";
import { clearPlatformOfflineSession } from "@/lib/offline/platform-cache";
import { unbindOfflineOrganization } from "@/lib/offline/db";
import { clearOfflineSession } from "@/lib/offline/session";
import { clearCartDraft } from "@/lib/sales/cart-draft";
import { clearCustomerDisplaySnapshot } from "@/lib/sales/customer-display";

type SignOutOptions = {
  signOut: () => Promise<void>;
  /** Kept for callers; sign-out always hard-navigates so `/login?signedOut=1` cannot be stripped. */
  router: AppRouterInstance;
  clearPresence?: () => Promise<unknown>;
};

const ONLINE_SIGNOUT_BUDGET_MS = 800;

function shouldSkipAwaitingCloudSignOut(): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  // Cap/Electron often report online while Convex never answers.
  if (typeof window !== "undefined" && (isCapacitor() || isElectron())) return true;
  return false;
}

export async function signOutAndRedirect({
  signOut,
  clearPresence,
}: SignOutOptions): Promise<void> {
  markExplicitLogout();
  clearOfflineSession();
  unbindOfflineOrganization();
  clearPlatformOfflineSession();
  clearLastRoute();
  clearCartDraft();
  clearCustomerDisplaySnapshot();
  clearUserDeviceState();
  // Never await — Convex mutations hang when the radio just dropped.
  void clearPresence?.().catch(() => {
    /* best-effort */
  });

  if (shouldSkipAwaitingCloudSignOut()) {
    void signOut().catch(() => {
      /* Convex unreachable — local clears already applied */
    });
    void navigateToLoginAfterSignOut();
    return;
  }

  try {
    await Promise.race([
      signOut().catch(() => undefined),
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ONLINE_SIGNOUT_BUDGET_MS);
      }),
    ]);
  } finally {
    void navigateToLoginAfterSignOut();
  }
}
