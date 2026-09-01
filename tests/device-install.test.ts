import { describe, expect, it } from "vitest";
import { resolveInstallPromptKind, resolveMobileInstallOs } from "@/lib/device-install";
import { telemetryRuntimeForDevice, type DeviceIdentity } from "@/lib/device";

describe("install prompt device detection", () => {
  it("classifies Android phones as mobile android", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    expect(resolveInstallPromptKind(ua)).toBe("mobile");
    expect(resolveMobileInstallOs(ua)).toBe("android");
  });

  it("classifies iPhone as mobile ios", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(resolveInstallPromptKind(ua)).toBe("mobile");
    expect(resolveMobileInstallOs(ua)).toBe("ios");
  });

  it("classifies Windows desktop as desktop", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(resolveInstallPromptKind(ua)).toBe("desktop");
    expect(resolveMobileInstallOs(ua)).toBeNull();
  });
});

describe("analytics delivery mode vs licence runtime", () => {
  function identity(partial: Partial<DeviceIdentity>): DeviceIdentity {
    return {
      fingerprint: "test",
      name: "Terminal",
      platform: "Windows",
      runtime: "web",
      deliveryMode: "browser",
      ...partial,
    };
  }

  it("keeps PWA distinct from browser while licensing stays web", () => {
    expect(telemetryRuntimeForDevice(identity({ deliveryMode: "browser" }))).toBe("web");
    expect(telemetryRuntimeForDevice(identity({ deliveryMode: "pwa" }))).toBe("pwa");
  });

  it("maps desktop installs to Electron and native apps to their OS", () => {
    expect(
      telemetryRuntimeForDevice(identity({ runtime: "desktop", deliveryMode: "electron" })),
    ).toBe("electron");
    expect(
      telemetryRuntimeForDevice(identity({ runtime: "android", deliveryMode: "capacitor" })),
    ).toBe("android");
  });
});
