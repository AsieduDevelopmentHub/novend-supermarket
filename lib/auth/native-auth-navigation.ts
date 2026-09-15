import { getElectronBridge, isCapacitor, isElectron } from "@novend/hardware";
import {
  capacitorBootUrl,
  CAPACITOR_BOOT_ORIGIN,
  LOGIN_AFTER_SIGN_OUT_PATH,
} from "@/lib/auth/capacitor-boot";
import { prepareHardNavigation } from "@/lib/auth/redirect-after-login";

type AuthShellBridge = {
  reloadAuthShell?: (entry?: string) => Promise<{ ok: boolean; message?: string }>;
};

/**
 * Land on `/login?signedOut=1` after sign-out.
 *
 * Capacitor: stay on the hosted origin so the service worker can serve the
 * precached login document while offline. Bouncing through
 * `https://localhost/?entry=…` leaves the SW and reloads the remote URL over
 * the network → Android “webpage not available”.
 *
 * Electron: always reload via the local offline-boot trampoline (same as cold
 * start). `navigator.onLine` is unreliable; `loadURL(https)` fails offline even
 * when Cache Storage already has `/login`.
 */
export async function navigateToLoginAfterSignOut(): Promise<void> {
  prepareHardNavigation();
  if (typeof window === "undefined") return;

  if (isElectron()) {
    const bridge = getElectronBridge<AuthShellBridge>();
    if (bridge?.reloadAuthShell) {
      const result = await bridge.reloadAuthShell(LOGIN_AFTER_SIGN_OUT_PATH);
      if (result.ok) return;
    }
  }

  if (isCapacitor()) {
    const onBootOrigin =
      window.location.origin === CAPACITOR_BOOT_ORIGIN || window.location.hostname === "localhost";
    if (onBootOrigin) {
      window.location.replace(capacitorBootUrl(LOGIN_AFTER_SIGN_OUT_PATH));
      return;
    }
  }

  window.location.replace(LOGIN_AFTER_SIGN_OUT_PATH);
}
