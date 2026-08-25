/**
 * Centralized permission helpers for native hardware.
 * Request only when a feature needs access — never at app startup.
 */

export type HardwarePermissionKind = "camera" | "photos" | "storage" | "notifications";

export type PermissionOutcome = {
  granted: boolean;
  /** User-facing explanation when denied or before prompting */
  message: string;
};

const FRIENDLY: Record<HardwarePermissionKind, { need: string; denied: string }> = {
  camera: {
    need: "Novend needs camera access to scan barcodes and capture product photos.",
    denied:
      "Camera access is turned off. Enable it in your device settings to scan barcodes and take product photos.",
  },
  photos: {
    need: "Novend needs photo library access so you can choose product images.",
    denied:
      "Photo library access is turned off. Enable it in your device settings to pick product images.",
  },
  storage: {
    need: "Novend needs storage access to save receipts and exports on this device.",
    denied:
      "Unable to save the file. Check storage permission in your device settings, then try again.",
  },
  notifications: {
    need: "Novend can send stock and subscription alerts on this device.",
    denied:
      "Notifications are turned off. Enable them in your device settings to receive stock and subscription alerts.",
  },
};

export function permissionNeedMessage(kind: HardwarePermissionKind): string {
  return FRIENDLY[kind].need;
}

export function permissionDeniedMessage(kind: HardwarePermissionKind): string {
  return FRIENDLY[kind].denied;
}

export function friendlyHardwareMessage(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  if (
    lower.includes("permission") ||
    lower.includes("denied") ||
    lower.includes("not authorized") ||
    lower.includes("access")
  ) {
    if (lower.includes("photo") || lower.includes("gallery") || lower.includes("library")) {
      return FRIENDLY.photos.denied;
    }
    if (lower.includes("storage") || lower.includes("filesystem") || lower.includes("file")) {
      return FRIENDLY.storage.denied;
    }
    return FRIENDLY.camera.denied;
  }
  if (lower.includes("not implemented") || lower.includes("unavailable")) {
    return fallback;
  }
  // Avoid leaking raw plugin / OS strings into the UI when they look technical.
  if (/capacitor|plugin|exception|nullpointer|ecode/i.test(raw)) {
    return fallback;
  }
  return raw;
}

export function filesystemSaveFailedMessage(): string {
  return "Unable to save the receipt. Please try again.";
}

export function shareFailedMessage(): string {
  return "Unable to share right now. Please try again.";
}

export function barcodeScanFailedMessage(): string {
  return "Could not read a barcode. Try again in good lighting, or enter the code manually.";
}

export function cameraCaptureFailedMessage(): string {
  return "Could not capture a photo. Please try again.";
}
