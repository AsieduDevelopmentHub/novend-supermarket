import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Dexie-first business lists", () => {
  it("skips live Convex list subscriptions when the mirror already has catalog rows", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/offline/freshness.ts"), "utf8");
    expect(source).toContain("mirrorHasCatalog");
    expect(source).toContain("shouldUseRemoteBusinessLists");
    expect(source).toMatch(/if \(await mirrorHasCatalog\(\)\) return false/);
  });
});
