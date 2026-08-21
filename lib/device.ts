/**
 * Device identity for licence activation.
 *
 * The fingerprint is a per-installation identifier persisted in localStorage
 * (and mirrored into the offline database). It is deliberately not a hardware
 * fingerprint: Novend counts installations, not machines, so reinstalling on
 * the same computer is expected to consume a slot until the old one is removed.
 */

import { formatOperatingSystem, getDesktopBridge, isDesktopRuntime } from "@/lib/desktop";

const FINGERPRINT_KEY = "novend.device.fingerprint";
const NAME_KEY = "novend.device.name";

export type DeviceRuntime = "desktop" | "web";

export type DeviceIdentity = {
  fingerprint: string;
  name: string;
  platform: string;
  runtime: DeviceRuntime;
  appVersion?: string;
};

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Stable identifier for this installation. Created on first use. */
export function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(FINGERPRINT_KEY);
    if (existing) return existing;
    const created = randomId();
    window.localStorage.setItem(FINGERPRINT_KEY, created);
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
  if (/Firefox\//i.test(userAgent)) return "Firefox";
  if (/Safari\//i.test(userAgent)) return "Safari";
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
      appVersion,
    };
  }

  const platform = detectBrowserPlatform(userAgent);
  return {
    fingerprint,
    name: stored ?? `${detectBrowserName(userAgent)} on ${platform}`,
    platform,
    runtime: "web",
  };
}
