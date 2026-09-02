import { getElectronBridge, isCapacitor, isElectron } from "@novend/hardware";
import {
  capacitorBootUrl,
  LOGIN_AFTER_SIGN_OUT_PATH,
} from "@/lib/auth/capacitor-boot";
import { prepareHardNavigation } from "@/lib/auth/redirect-after-login";

type AuthShellBridge = {
  reloadAuthShell?: (entry?: string) => Promise<{ ok: boolean; message?: string }>;
};

/**
 * Land on `/login?signedOut=1` after sign-out.
 *
 * Native shells load the hosted app from a remote origin. A direct
 * `location.replace("/login")` while offline hits the network and shows the
 * WebView "page not available" screen. Route through the bundled boot page
 * so the service worker can serve the cached login shell instead.
 */
export async function navigateToLoginAfterSignOut(): Promise<void> {
  prepareHardNavigation();
  if (typeof window === "undefined") return;

  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  if (isCapacitor() && offline) {
    window.location.replace(capacitorBootUrl(LOGIN_AFTER_SIGN_OUT_PATH));
    return;
  }

  if (isElectron() && offline) {
    const bridge = getElectronBridge<AuthShellBridge>();
    if (bridge?.reloadAuthShell) {
      const result = await bridge.reloadAuthShell(LOGIN_AFTER_SIGN_OUT_PATH);
      if (result.ok) return;
    }
  }

  window.location.replace(LOGIN_AFTER_SIGN_OUT_PATH);
}
