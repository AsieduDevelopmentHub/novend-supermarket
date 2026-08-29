/**
 * Device identity for licence activation.
 *
 * The fingerprint is a per-installation identifier persisted in localStorage
 * (and mirrored into the offline database). It is deliberately not a hardware
 * fingerprint: Novend counts installations, not machines, so reinstalling on
 * the same computer is expected to consume a slot until the old one is removed.
 *
 * Capacitor and the mobile browser are separate installations even on one phone:
 * they use different storage + different runtime labels (`android`/`ios` vs `web`).
 */

import { APP_VERSION } from "@/constants/app";
import { formatOperatingSystem, getDesktopBridge, isDesktopRuntime } from "@/lib/desktop";
import { isStandaloneWebApp } from "@/lib/device-install";
import { Hardware, getPlatform, isCapacitor } from "@novend/hardware";

const FINGERPRINT_KEY = "novend.device.fingerprint";
const FINGERPRINT_KEY_CAP = "novend.device.fingerprint.native";
const NAME_KEY = "novend.device.name";

export type DeviceRuntime = "desktop" | "web" | "android" | "ios";
export type DeviceDeliveryMode = "browser" | "pwa" | "electron" | "capacitor";

export type DeviceIdentity = {
  fingerprint: string;
  name: string;
  platform: string;
  runtime: DeviceRuntime;
  deliveryMode: DeviceDeliveryMode;
  appVersion?: string;
};

export function telemetryRuntimeForDevice(identity: DeviceIdentity) {
  if (identity.runtime === "desktop") return "electron" as const;
  if (identity.runtime === "web") {
    return identity.deliveryMode === "pwa" ? ("pwa" as const) : ("web" as const);
  }
  return identity.runtime;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function fingerprintStorageKey(): string {
  return isCapacitor() ? FINGERPRINT_KEY_CAP : FINGERPRINT_KEY;
}

/** Stable identifier for this installation. Created on first use. */
export function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "";
  const key = fingerprintStorageKey();
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    // Migrate legacy Cap installs that wrote the shared web key before we split.
    if (isCapacitor()) {
      const legacy = window.localStorage.getItem(FINGERPRINT_KEY);
      if (legacy) {
        window.localStorage.setItem(key, legacy);
        return legacy;
      }
    }
    const created = randomId();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    // Private browsing without storage: fall back to a session-only id so the
    // app still works, at the cost of registering as a new device each time.
    return randomId();
  }
}

export function getStoredDeviceName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

export function setStoredDeviceName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    /* storage unavailable — the server copy is still authoritative */
  }
}

function detectBrowserPlatform(userAgent: string): string {
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Android/i.test(userAgent)) return "Android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
  if (/Mac OS X|Macintosh/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "Unknown";
}

function detectBrowserName(userAgent: string): string {
  if (/Edg\//i.test(userAgent)) return "Edge";
  if (/OPR\//i.test(userAgent)) return "Opera";
  if (/Chrome\//i.test(userAgent) && !/Chromium/i.test(userAgent)) return "Chrome";
  if (/Firefox/i.test(userAgent)) return "Firefox";
  if (/Safari\//i.test(userAgent)) return "Safari";
  return "Browser";
}

function runtimeLabel(runtime: DeviceRuntime): string {
  switch (runtime) {
    case "desktop":
      return "Desktop app";
    case "android":
      return "Android app";
    case "ios":
      return "iOS app";
    default:
      return "Browser";
  }
}

/** Human label for activated-device lists. */
export function formatDeviceRuntime(runtime: string | null | undefined): string {
  if (runtime === "desktop" || runtime === "android" || runtime === "ios" || runtime === "web") {
    return runtimeLabel(runtime);
  }
  return "Browser";
}

/** Everything the server needs to register this terminal. */
export async function describeClientDevice(): Promise<DeviceIdentity> {
  const fingerprint = getDeviceFingerprint();
  const stored = getStoredDeviceName();
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;

  if (isDesktopRuntime()) {
    const bridge = getDesktopBridge();
    let platform = "Desktop";
    let appVersion: string | undefined;
    try {
      const runtime = await bridge?.getRuntime();
      platform = formatOperatingSystem(runtime?.platform);
      appVersion = runtime?.version;
    } catch {
      platform = detectBrowserPlatform(userAgent);
    }
    return {
      fingerprint,
      name: stored ?? `${platform} terminal`,
      platform,
      runtime: "desktop",
      deliveryMode: "electron",
      appVersion,
    };
  }

  if (isCapacitor()) {
    const native = getPlatform();
    const runtime: DeviceRuntime = native === "ios" ? "ios" : "android";
    const platform = runtime === "ios" ? "iOS" : "Android";
    let appVersion = APP_VERSION;
    try {
      const info = await Hardware.app.getInfo();
      if (info.data?.version) appVersion = info.data.version;
    } catch {
      /* keep APP_VERSION */
    }
    // Older builds stored UA-based names ("Chrome on Android") even inside Cap.
    const defaultName = `Novend ${platform} app`;
    const name =
      stored && !/^(Chrome|Safari|Firefox|Edge|Opera|Browser) on /i.test(stored)
        ? stored
        : defaultName;
    return {
      fingerprint,
      name,
      platform,
      runtime,
      deliveryMode: "capacitor",
      appVersion,
    };
  }

  const platform = detectBrowserPlatform(userAgent);
  return {
    fingerprint,
    name: stored ?? `${detectBrowserName(userAgent)} on ${platform}`,
    platform,
    runtime: "web",
    deliveryMode: isStandaloneWebApp() ? "pwa" : "browser",
    appVersion: APP_VERSION,
  };
}
