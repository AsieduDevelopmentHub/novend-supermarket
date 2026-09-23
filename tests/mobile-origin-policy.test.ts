import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APPROVED_MOBILE_HOSTS,
  isProductionMobileBuild,
  mobileNavigationHosts,
  resolveMobileAppOrigin,
} from "../scripts/mobile-origin-policy.mjs";

describe("Capacitor mobile origin policy", () => {
  it("accepts the exact approved production origin", () => {
    expect(
      resolveMobileAppOrigin(
        { NOVEND_APP_URL: "https://novend-pos.vercel.app" },
        { production: true },
      ),
    ).toMatchObject({
      origin: "https://novend-pos.vercel.app",
      hostname: "novend-pos.vercel.app",
      liveReload: false,
    });
  });

  it.each([
    [{}, "required"],
    [{ NOVEND_APP_URL: "not a URL" }, "valid absolute URL"],
    [{ NOVEND_APP_URL: "http://novend-pos.vercel.app" }, "HTTPS"],
    [{ NOVEND_APP_URL: "https://localhost" }, "not approved"],
    [{ NOVEND_APP_URL: "https://evil.vercel.app" }, "not approved"],
    [{ NOVEND_APP_URL: "https://novend-pos.vercel.app/redirect" }, "origin only"],
  ])("rejects an unsafe production configuration", (env, message) => {
    expect(() => resolveMobileAppOrigin(env, { production: true })).toThrow(message);
  });

  it("permits cleartext only on private development hosts", () => {
    expect(
      resolveMobileAppOrigin({ NOVEND_APP_URL: "http://192.168.1.20:3000" }, { production: false })
        .liveReload,
    ).toBe(true);
    expect(() =>
      resolveMobileAppOrigin({ NOVEND_APP_URL: "http://example.com:3000" }, { production: false }),
    ).toThrow("only for localhost, emulator, or private LAN");
  });

  it("emits exact hosts without a Vercel wildcard", () => {
    const hosts = mobileNavigationHosts("10.0.2.2");
    expect(hosts).toEqual(["10.0.2.2", ...APPROVED_MOBILE_HOSTS]);
    expect(hosts).not.toContain("*.vercel.app");
  });

  it("does not retain wildcard navigation in native configuration", () => {
    const capacitorConfig = readFileSync(
      resolve(process.cwd(), "apps/mobile/capacitor.config.ts"),
      "utf8",
    );
    const syncedIosConfig = readFileSync(
      resolve(process.cwd(), "apps/mobile/ios/App/App/capacitor.config.json"),
      "utf8",
    );
    expect(capacitorConfig).not.toContain("*.vercel.app");
    expect(syncedIosConfig).not.toContain("*.vercel.app");
  });

  it("treats NODE_ENV=production as a production mobile build", () => {
    expect(isProductionMobileBuild({ NODE_ENV: "production" })).toBe(true);
    expect(isProductionMobileBuild({ NODE_ENV: "development" })).toBe(false);
  });
});
