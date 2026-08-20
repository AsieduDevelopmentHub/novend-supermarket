/** Detect mobile browsers where PWA / home-screen install applies. */
export function isMobileBrowser(userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  if (!userAgent) return false;
  if (/iPad.*Macintosh/i.test(userAgent)) return true;
  return /Android|iPhone|iPod|Mobile/i.test(userAgent);
}

/** True when the web app is already installed (standalone / home screen). */
export function isStandaloneWebApp() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export function isIosSafari(userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  if (!userAgent) return false;
  return /iPhone|iPad|iPod/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);
}

export type InstallPromptKind = "desktop" | "mobile";

/** Which install nudge to show in the browser shell. */
export function resolveInstallPromptKind(
  userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "",
): InstallPromptKind | null {
  if (isStandaloneWebApp()) return null;
  if (isMobileBrowser(userAgent)) return "mobile";
  return "desktop";
}
