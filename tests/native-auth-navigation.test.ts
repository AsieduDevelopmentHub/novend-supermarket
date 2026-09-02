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

  it("routes offline native shells through boot before login", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/auth/native-auth-navigation.ts"), "utf8");
    expect(source).toContain("capacitorBootUrl(LOGIN_AFTER_SIGN_OUT_PATH)");
    expect(source).toContain("reloadAuthShell");
    expect(source).toContain("!navigator.onLine");
  });

  it("sign-out delegates navigation to native auth helper", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/auth/sign-out.ts"), "utf8");
    expect(source).toContain("navigateToLoginAfterSignOut");
    expect(source).not.toContain('window.location.replace("/login?signedOut=1")');
  });
});
