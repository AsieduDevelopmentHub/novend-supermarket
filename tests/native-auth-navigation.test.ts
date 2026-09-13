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

  it("keeps Cap on the hosted origin and always uses Electron boot reload", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/auth/native-auth-navigation.ts"), "utf8");
    expect(source).toContain("LOGIN_AFTER_SIGN_OUT_PATH");
    expect(source).toContain("reloadAuthShell");
    expect(source).toContain("CAPACITOR_BOOT_ORIGIN");
    expect(source).not.toContain("!navigator.onLine");
  });

  it("sign-out delegates navigation to native auth helper", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/auth/sign-out.ts"), "utf8");
    expect(source).toContain("navigateToLoginAfterSignOut");
    expect(source).not.toContain('window.location.replace("/login?signedOut=1")');
  });

  it("service worker serves cached login when auth document fetch fails", () => {
    const sw = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    expect(sw).toContain('caches.match("/login")');
    expect(sw).toContain("isAuthDocument(url)");
    expect(sw).toContain("await fetch(request)");
  });
});
