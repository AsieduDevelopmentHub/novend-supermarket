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

  it("probes the hosted origin without CORS and still hands off to the hosted shell", () => {
    expect(source).toContain('mode: "no-cors"');
    expect(source).toContain('response.type !== "opaque"');
    expect(source).toMatch(/\.catch\(function \(\) \{[\s\S]*?leaveBoot\(\);/);
  });
});
