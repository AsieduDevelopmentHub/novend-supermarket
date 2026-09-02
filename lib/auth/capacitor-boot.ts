/** Capacitor local boot origin — matches apps/mobile/capacitor.config.ts `server.hostname`. */
export const CAPACITOR_BOOT_ORIGIN = "https://localhost";

export const LOGIN_AFTER_SIGN_OUT_PATH = "/login?signedOut=1";

export function capacitorBootUrl(entry: string): string {
  const normalized = entry.startsWith("/") ? entry : `/${entry}`;
  return `${CAPACITOR_BOOT_ORIGIN}/?entry=${encodeURIComponent(normalized)}`;
}
