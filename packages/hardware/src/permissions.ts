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

function permissionKindFromMessage(lower: string): HardwarePermissionKind | null {
  if (lower.includes("photo") || lower.includes("gallery") || lower.includes("library")) {
    return "photos";
  }
  if (lower.includes("notification")) return "notifications";
  if (lower.includes("storage") || lower.includes("filesystem") || lower.includes("file")) {
    return "storage";
  }
  if (lower.includes("camera")) return "camera";
  return null;
}

export function friendlyHardwareMessage(
  raw: string | undefined,
  fallback: string,
  kind?: HardwarePermissionKind,
): string {
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  if (
    lower.includes("not implemented") ||
    lower.includes("unimplemented") ||
    lower.includes("plugin is not available") ||
    lower.includes("is not implemented on")
  ) {
    return fallback;
  }
  const looksLikePermission =
    lower.includes("permission") ||
    lower.includes("denied") ||
    lower.includes("not authorized") ||
    lower.includes("user denied");
  if (looksLikePermission) {
    const inferred = permissionKindFromMessage(lower) ?? kind;
    if (inferred) return FRIENDLY[inferred].denied;
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

export function printFailedMessage(): string {
  return "Could not open the print dialog. Try again, or use Share / Save PDF.";
}

export function bluetoothPrintFailedMessage(code?: string, fallback?: string): string {
  switch (code) {
    case "permission":
      return "Allow Nearby devices / Bluetooth access for Novend, then try again.";
    case "bluetooth_off":
      return "Turn on Bluetooth and try again.";
    case "not_paired":
      return "No Bluetooth printer selected. Open Settings → Hardware to pair one.";
    case "out_of_range":
      return "Could not reach the printer. Keep it nearby and powered on.";
    case "unsupported":
      return fallback || "This printer is not supported on this device.";
    case "busy":
      return "Another print is still in progress. Try again in a moment.";
    case "cancelled":
      return "Cancelled";
    default:
      return fallback || "Could not print to the Bluetooth printer. Try Share or Save PDF.";
  }
}

export function barcodeScanFailedMessage(): string {
  return "Could not read a barcode. Try again in good lighting, or enter the code manually.";
}

export function cameraCaptureFailedMessage(): string {
  return "Could not capture a photo. Please try again.";
}
