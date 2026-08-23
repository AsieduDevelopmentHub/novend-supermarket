/**
 * Runtime detection for the Electron desktop shell.
 * Prefer `@novend/hardware` platform helpers for new code.
 * The preload script exposes `window.novendDesktop`.
 */
import { getElectronBridge, isElectron } from "@novend/hardware";
import type { NovendDesktopBridge } from "@/types/desktop";

export function getDesktopBridge(): NovendDesktopBridge | null {
  return getElectronBridge<NovendDesktopBridge>();
}

/** True when running inside the Novend POS desktop app. */
export function isDesktopRuntime(): boolean {
  return isElectron();
}

const OS_LABELS: Record<string, string> = {
  win32: "Windows",
  darwin: "macOS",
  linux: "Linux",
};

/** Human-readable OS name for the UI — never expose raw Node platform ids. */
export function formatOperatingSystem(platform: string | null | undefined): string {
  if (!platform) return "Unknown OS";
  return OS_LABELS[platform] ?? platform;
}

export type BrowserDesktopTarget = {
  platform: "win32" | "darwin" | "linux";
  arch: "x64" | "arm64";
  label: string;
};

/**
 * Infer the best desktop installer target from the browser user agent.
 * Returns null on phones/tablets where Electron installers are not useful.
 */
export function detectBrowserDesktopTarget(
  userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "",
): BrowserDesktopTarget | null {
  const ua = userAgent || "";
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua) && !/iPad.*Macintosh/i.test(ua)) {
    if (/iPhone|iPod|Android.*Mobile/i.test(ua)) return null;
  }

  const arch: "x64" | "arm64" = /aarch64|arm64|Apple Silicon/i.test(ua) ? "arm64" : "x64";

  if (/Windows/i.test(ua)) {
    return { platform: "win32", arch, label: "Windows" };
  }
  if (/Mac OS X|Macintosh/i.test(ua)) {
    if (
      typeof navigator !== "undefined" &&
      navigator.maxTouchPoints > 1 &&
      /MacIntel/.test(navigator.platform)
    ) {
      return null;
    }
    return { platform: "darwin", arch, label: "macOS" };
  }
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) {
    return { platform: "linux", arch, label: "Linux" };
  }
  return null;
}
