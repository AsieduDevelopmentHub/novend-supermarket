import { isCapacitor } from "../platform";
import type { HardwareResult } from "../types";
import type { BiometricAvailability, NotificationPermissionState } from "../native-types";

type NovendNativeSecurity = {
  notificationState?: () => string;
  openNotificationSettings?: () => boolean;
  biometricStatus?: () => string;
  authenticateBiometric?: (reason: string) => string;
};

function nativeSecurity(): NovendNativeSecurity | null {
  if (typeof window === "undefined" || !isCapacitor()) return null;
  const bridge = (window as Window & { NovendNative?: NovendNativeSecurity }).NovendNative;
  return bridge ?? null;
}

export function hasNovendNativeSecurity(): boolean {
  const bridge = nativeSecurity();
  return Boolean(
    bridge &&
    typeof bridge.notificationState === "function" &&
    typeof bridge.biometricStatus === "function",
  );
}

export function readNativeNotificationState(): NotificationPermissionState | null {
  const bridge = nativeSecurity();
  if (!bridge || typeof bridge.notificationState !== "function") return null;
  try {
    const state = bridge.notificationState();
    if (state === "granted" || state === "denied") return state;
    return null;
  } catch {
    return null;
  }
}

export function openNativeNotificationSettings(): boolean {
  const bridge = nativeSecurity();
  if (!bridge || typeof bridge.openNotificationSettings !== "function") return false;
  try {
    return bridge.openNotificationSettings() === true;
  } catch {
    return false;
  }
}

export function readNativeBiometricStatus(): BiometricAvailability | null {
  const bridge = nativeSecurity();
  if (!bridge || typeof bridge.biometricStatus !== "function") return null;
  try {
    const parsed = JSON.parse(bridge.biometricStatus()) as {
      available?: boolean;
      supported?: boolean;
      enrolled?: boolean;
      type?: BiometricAvailability["biometryType"];
      reason?: string;
    };
    const type = parsed.type ?? "none";
    const reason =
      typeof parsed.reason === "string" && parsed.reason.length > 0 ? parsed.reason : undefined;
    return {
      available: Boolean(parsed.available),
      supported: Boolean(parsed.supported),
      enrolled: Boolean(parsed.enrolled),
      biometryType:
        type === "fingerprint" || type === "face" || type === "iris" || type === "unknown"
          ? type
          : "none",
      reason,
    };
  } catch {
    return null;
  }
}

export function authenticateNativeBiometric(reason: string): HardwareResult | null {
  const bridge = nativeSecurity();
  if (!bridge || typeof bridge.authenticateBiometric !== "function") return null;
  try {
    const outcome = bridge.authenticateBiometric(reason);
    if (outcome === "ok") return { ok: true };
    if (outcome === "cancelled") return { ok: false, message: "Cancelled" };
    return { ok: false, message: "Could not verify your identity. Try again." };
  } catch {
    return { ok: false, message: "Could not verify your identity. Try again." };
  }
}
