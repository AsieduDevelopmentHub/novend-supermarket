import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "apps/mobile/www/index.html"), "utf8");

describe("Capacitor local boot page", () => {
  it("probes the hosted origin without CORS and keeps failures on local recovery UI", () => {
    expect(source).toContain('mode: "no-cors"');
    expect(source).toContain('response.type !== "opaque"');
    expect(source).toMatch(/\.catch\(function \(\) \{[\s\S]*?showFailed\(/);
    expect(source).not.toMatch(/\.catch\(function \(\) \{[\s\S]*?leaveBoot\(\);[\s\S]*?\}\);/);
  });
});
