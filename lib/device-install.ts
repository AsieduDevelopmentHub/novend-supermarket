/** Detect mobile browsers where PWA / home-screen install applies. */
export function isMobileBrowser(userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  if (!userAgent) return false;
  if (/iPad.*Macintosh/i.test(userAgent)) return true;
  return /Android|iPhone|iPod|Mobile/i.test(userAgent);
}

/** Capacitor WebView — not a mobile browser tab and not a PWA install target. */
export function isCapacitorWebView(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  if (/NovendCapacitor/i.test(ua)) return true;
  if (/Android/i.test(ua) && /\bwv\b/i.test(ua)) return true;
  const win = window as Window & {
    androidBridge?: unknown;
    webkit?: { messageHandlers?: { bridge?: unknown } };
    Capacitor?: { isNativePlatform?: () => boolean };
  };
  if (win.androidBridge || win.webkit?.messageHandlers?.bridge) return true;
  return Boolean(win.Capacitor?.isNativePlatform?.());
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

export function isIosBrowser(userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  if (!userAgent) return false;
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  // iPadOS desktop UA
  if (
    typeof navigator !== "undefined" &&
    navigator.maxTouchPoints > 1 &&
    /MacIntel/.test(navigator.platform || "")
  ) {
    return true;
  }
  return false;
}

export function isAndroidBrowser(userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  return /Android/i.test(userAgent || "");
}

export type InstallPromptKind = "desktop" | "mobile";

/** Which install nudge to show in the browser shell. */
export function resolveInstallPromptKind(
  userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "",
): InstallPromptKind | null {
  if (isCapacitorWebView()) return null;
  if (isStandaloneWebApp()) return null;
  if (isMobileBrowser(userAgent) || isIosBrowser(userAgent)) return "mobile";
  return "desktop";
}

/** Mobile OS for native-vs-PWA install decisions. */
export type MobileInstallOs = "android" | "ios";

export function resolveMobileInstallOs(
  userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "",
): MobileInstallOs | null {
  if (isAndroidBrowser(userAgent)) return "android";
  if (isIosBrowser(userAgent)) return "ios";
  if (isMobileBrowser(userAgent)) return "android";
  return null;
}
