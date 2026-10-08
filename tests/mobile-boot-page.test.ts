import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "apps/mobile/www/index.html"), "utf8");
const config = readFileSync(resolve(process.cwd(), "apps/mobile/www/app-config.js"), "utf8");

describe("Capacitor local boot page", () => {
  it("opens the hosted dashboard directly so Cache Storage can serve offline", () => {
    expect(source).toContain("fromBoot=1");
    expect(source).not.toContain("/api/boot?entry=");
    expect(source).not.toContain("/api/health");
    expect(config).toContain('NOVEND_APP_ENTRY = "/dashboard"');
  });

  it("boots the hosted app shell (dashboard), not login", () => {
    expect(source).toContain('|| "/dashboard"');
    expect(config).toContain('NOVEND_APP_ENTRY = "/dashboard"');
  });

  it("uses only the baked origin and a narrow boot-entry allowlist", () => {
    expect(source).not.toContain('params.get("appUrl")');
    expect(source).toContain("window.NOVEND_ALLOWED_HOSTS");
    expect(source).toContain('requestedEntry === "/login?signedOut=1"');
    expect(source).toContain('signedOutLeave = entry.indexOf("signedOut=1") >= 0');
    expect(source).toContain("!signedOutLeave && !fromLoginLeave");
    expect(config).toContain("NOVEND_ALLOWED_HOSTS");
    expect(config).toContain("dashboard.novendpos.app");
  });

  it("only shows the connect-once screen after a WebView load failure (stay=1)", () => {
    expect(source).toContain('params.get("stay") === "1"');
    expect(source).toContain("showFailed");
    expect(source).toContain("leaveBoot");
  });
});
