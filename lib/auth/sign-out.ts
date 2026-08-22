import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { clearOfflineSession } from "@/lib/offline/session";
import { clearShellProfile } from "@/lib/offline/shell-profile";

type SignOutOptions = {
  signOut: () => Promise<void>;
  router: AppRouterInstance;
  clearPresence?: () => Promise<unknown>;
};

/** End the session and navigate to login immediately (web/PWA-friendly). */
export async function signOutAndRedirect({
  signOut,
  router,
  clearPresence,
}: SignOutOptions): Promise<void> {
  clearOfflineSession();
  void clearPresence?.().catch(() => {
    /* best-effort */
  });
  void clearShellProfile().catch(() => {
    /* best-effort */
  });

  try {
    await signOut();
  } finally {
    router.replace("/login");
    void router.refresh();
  }
}
