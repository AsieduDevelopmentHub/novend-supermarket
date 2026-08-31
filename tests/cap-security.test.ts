import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const bridge = readFileSync(
  resolve(process.cwd(), "apps/mobile/android/app/src/main/java/com/novend/pos/NovendNativeBridge.java"),
  "utf8",
);
const services = readFileSync(
  resolve(process.cwd(), "packages/hardware/src/adapters/cap-services.ts"),
  "utf8",
);
const barcode = readFileSync(
  resolve(process.cwd(), "components/hardware/scan-barcode-camera-dialog.tsx"),
  "utf8",
);
const photo = readFileSync(
  resolve(process.cwd(), "features/products/components/take-product-photo-dialog.tsx"),
  "utf8",
);

describe("Capacitor Settings security bridge", () => {
  it("reads notification and biometric state from NovendNative", () => {
    expect(bridge).toContain("notificationState");
    expect(bridge).toContain("openNotificationSettings");
    expect(bridge).toContain("biometricStatus");
    expect(bridge).toContain("authenticateBiometric");
    expect(bridge).toContain("BiometricManager");
    expect(bridge).toContain("BIOMETRIC_WEAK");
    expect(bridge).toContain("canAuthenticateBiometric");
    expect(bridge).toContain("setNegativeButtonText");
    expect(bridge).not.toMatch(
      /BIOMETRIC_SUCCESS\s*\r?\n\s*\|\|\s*strong == BiometricManager\.BIOMETRIC_ERROR_NONE_ENROLLED/,
    );
    expect(bridge).toContain("ACTION_APP_NOTIFICATION_SETTINGS");
    expect(services).toContain("readNativeNotificationState");
    expect(services).toContain("readNativeBiometricStatus");
    expect(services).toContain("authenticateNativeBiometric");
    expect(services).not.toContain("BiometricAuth.checkBiometry");
    expect(services).not.toContain("LocalNotifications.checkPermissions");
  });

  it("does not pass undefined into setError", () => {
    expect(barcode).toContain('setError(photo.message ?? "Could not open camera")');
    expect(photo).toContain('setError(result.message ?? "Could not open camera")');
  });
});
