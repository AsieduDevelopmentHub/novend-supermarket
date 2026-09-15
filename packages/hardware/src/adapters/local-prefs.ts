import { isCapacitor } from "../platform";

/**
 * Device-local prefs that must work after the WebView leaves localhost.
 * Capacitor Preferences often hangs on the hosted origin — use localStorage.
 */
export function readLocalPref(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalPref(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota / private mode */
  }
}

export function removeLocalPref(key: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function isHostedCapacitorShell(): boolean {
  return isCapacitor();
}
