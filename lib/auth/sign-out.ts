import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { clearLastRoute } from "@/lib/auth/last-route";
import { markExplicitLogout } from "@/lib/auth/logout-flag";
import { prepareHardNavigation } from "@/lib/auth/redirect-after-login";
import { clearPlatformOfflineSession } from "@/lib/offline/platform-cache";
import { clearOfflineSession } from "@/lib/offline/session";
import { clearShellProfile } from "@/lib/offline/shell-profile";
import { clearCartDraft } from "@/lib/sales/cart-draft";
import { isCapacitor } from "@novend/hardware";

type SignOutOptions = {
  signOut: () => Promise<void>;
  router: AppRouterInstance;
  clearPresence?: () => Promise<unknown>;
};

/**
 * End the session and land on a clean login screen.
 * Await Dexie identity clear *before* navigation so the next user cannot
 * inherit the previous replica, last route, or splash-cover loop.
 */
export async function signOutAndRedirect({
  signOut,
  router,
  clearPresence,
}: SignOutOptions): Promise<void> {
  markExplicitLogout();
  clearOfflineSession();
  clearPlatformOfflineSession();
  clearLastRoute();
  clearCartDraft();
  void clearPresence?.().catch(() => {
    /* best-effort */
  });
  try {
    await clearShellProfile();
  } catch {
    /* Dexie unavailable */
  }

  try {
    await signOut();
  } finally {
    const loginHref = "/login?signedOut=1";
    if (typeof window !== "undefined" && (isCapacitor() || !navigator.onLine)) {
      prepareHardNavigation();
      window.location.replace(loginHref);
      return;
    }
    router.replace(loginHref);
    void router.refresh();
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        if (window.location.pathname === "/login") return;
        prepareHardNavigation();
        window.location.replace(loginHref);
      }, 1200);
    }
  }
}
