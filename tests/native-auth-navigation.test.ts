import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  capacitorBootUrl,
  CAPACITOR_BOOT_ORIGIN,
  LOGIN_AFTER_SIGN_OUT_PATH,
} from "@/lib/auth/capacitor-boot";

describe("native auth navigation", () => {
  it("builds a Capacitor boot URL for login after sign-out", () => {
    expect(capacitorBootUrl(LOGIN_AFTER_SIGN_OUT_PATH)).toBe(
      `${CAPACITOR_BOOT_ORIGIN}/?entry=${encodeURIComponent(LOGIN_AFTER_SIGN_OUT_PATH)}`,
    );
  });

  it("keeps Cap on the hosted origin and never awaits Electron reload forever", () => {
    const source = readFileSync(
      resolve(process.cwd(), "lib/auth/native-auth-navigation.ts"),
      "utf8",
    );
    expect(source).toContain("LOGIN_AFTER_SIGN_OUT_PATH");
    expect(source).toContain("LOGIN_AFTER_SIGN_OUT_NATIVE");
    expect(source).toContain("loginAfterSignOutHref");
    expect(source).toContain("reloadAuthShell");
    expect(source).toContain("CAPACITOR_BOOT_ORIGIN");
    expect(source).toContain("HARD_LEAVE_FALLBACK_MS");
    expect(source).toContain("hardLeaveToLogin");
    expect(source).toContain("isCapacitor() || isElectron()");
    expect(source).not.toContain("await bridge.reloadAuthShell");
  });

  it("sign-out kicks navigation without awaiting hung cloud calls", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/auth/sign-out.ts"), "utf8");
    expect(source).toContain("navigateToLoginAfterSignOut");
    expect(source).toContain("void navigateToLoginAfterSignOut()");
    expect(source).toContain("shouldSkipAwaitingCloudSignOut");
    expect(source).not.toContain('window.location.replace("/login?signedOut=1")');
  });

  it("app shell watchdogs a stuck Signing out splash", () => {
    const layout = readFileSync(resolve(process.cwd(), "app/(app)/app-layout-client.tsx"), "utf8");
    expect(layout).toContain('label="Signing out…"');
    expect(layout).toContain("navigateToLoginAfterSignOut");
    expect(layout).toContain("hasExplicitLogout()");
  });

  it("service worker validates auth cache and does not poison login via cache.add", () => {
    const sw = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    expect(sw).toContain('caches.match(expected)');
    expect(sw).toContain("isAuthDocument(url)");
    expect(sw).toContain("precacheAuthDocument");
    expect(sw).toContain("isUsableAuthCache");
    expect(sw).toContain("X-Novend-Auth-Doc");
    expect(sw).toContain('url.searchParams.get("signedOut") === "1"');
    expect(sw).toContain("preferCache = fromBoot || (signedOut && offline)");
    expect(sw).toContain('const AUTH_PRECACHE = ["/login", "/signup"]');
    const precacheBlock = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)?.[1] ?? "";
    expect(precacheBlock).not.toContain('"/login"');
    expect(precacheBlock).not.toContain('"/signup"');
  });
});
