import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("mobile updates cache policy", () => {
  it("uses ISR revalidate and CDN cache headers instead of force-dynamic", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/api/mobile-updates/latest/route.ts"),
      "utf8",
    );
    expect(source).toContain("export const revalidate = 300");
    expect(source).toContain("s-maxage=300");
    expect(source).toContain("stale-while-revalidate=600");
    expect(source).not.toContain('dynamic = "force-dynamic"');
    expect(source).not.toContain('cache: "no-store"');
  });
});
