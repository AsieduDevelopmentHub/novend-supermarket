/**
 * Unified runtime platform detection for Novend.
 * Prefer these helpers over scattering `window` checks in UI.
 */

export type NovendPlatform = "web" | "electron" | "android" | "ios";

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

type WindowWithBridges = Window & {
  Capacitor?: CapacitorGlobal;
  novendDesktop?: unknown;
  /** Injected by Capacitor Android WebView before page scripts run. */
  androidBridge?: unknown;
  webkit?: { messageHandlers?: { bridge?: unknown } };
};

function getWindow(): WindowWithBridges | null {
  if (typeof window === "undefined") return null;
  return window as WindowWithBridges;
}

function getCapacitor(): CapacitorGlobal | null {
  return getWindow()?.Capacitor ?? null;
}

function hasElectronBridge(): boolean {
  return Boolean(getWindow()?.novendDesktop);
}

/**
 * Detect native Capacitor bridge the same way @capacitor/core does internally.
 * Works even when `server.url` loads a remote origin and Capacitor globals
 * are not fully initialized on the first React paint.
 */
function getCapacitorBridgePlatform(): NovendPlatform | null {
  const win = getWindow();
  if (!win) return null;
  if (win.androidBridge) return "android";
  if (win.webkit?.messageHandlers?.bridge) return "ios";
  return null;
}

/** Resolve the current host platform once per call (cheap). */
export function getPlatform(): NovendPlatform {
  if (typeof window === "undefined") return "web";

  if (hasElectronBridge()) return "electron";

  const bridgePlatform = getCapacitorBridgePlatform();
  if (bridgePlatform) return bridgePlatform;

  const cap = getCapacitor();
  if (cap?.isNativePlatform?.()) {
    const native = (cap.getPlatform?.() ?? "").toLowerCase();
    if (native === "ios") return "ios";
    if (native === "android") return "android";
    return "android";
  }

  const capPlatform = (cap?.getPlatform?.() ?? "").toLowerCase();
  if (capPlatform === "ios" || capPlatform === "android") {
    return capPlatform;
  }

  return "web";
}

export function isWeb(): boolean {
  return getPlatform() === "web";
}

export function isElectron(): boolean {
  return getPlatform() === "electron";
}

export function isCapacitor(): boolean {
  const p = getPlatform();
  return p === "android" || p === "ios";
}

export function isAndroid(): boolean {
  return getPlatform() === "android";
}

export function isIOS(): boolean {
  return getPlatform() === "ios";
}

/** Desktop Electron bridge when present (typed loosely to avoid coupling). */
export function getElectronBridge<T = unknown>(): T | null {
  if (typeof window === "undefined") return null;
  return ((window as Window & { novendDesktop?: T }).novendDesktop ?? null) as T | null;
}
