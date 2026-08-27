import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "apps/mobile/www/index.html"), "utf8");
const config = readFileSync(resolve(process.cwd(), "apps/mobile/www/app-config.js"), "utf8");

describe("Capacitor local boot page", () => {
  it("boots the hosted app shell (dashboard), not login", () => {
    expect(source).toContain('|| "/dashboard"');
    expect(config).toContain('NOVEND_APP_ENTRY = "/dashboard"');
  });

  it("probes hosted health with CORS before navigating, and can stay on boot", () => {
    expect(source).toContain("/api/health");
    expect(source).toContain('mode: "cors"');
    expect(source).toContain('params.get("stay") === "1"');
    expect(source).toContain("showFailed");
  });
});
