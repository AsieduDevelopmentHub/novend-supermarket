import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("proxy public routes", () => {
  it("keeps marketing pricing/product in isPublicRoute and static short-circuit", () => {
    const source = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");

    expect(source).toContain('"/pricing"');
    expect(source).toContain('"/pricing/(.*)"');
    expect(source).toContain('"/product"');
    expect(source).toContain('"/product/(.*)"');
    expect(source).toContain('"/contact"');
    expect(source).toContain('"/contact/(.*)"');
    expect(source).toContain('"/demo"');
    expect(source).toContain('"/demo/(.*)"');
    expect(source).toContain("isStaticPublicRoute");
    expect(source).toContain("isPublicRoute");

    // Matcher entries are segment-bounded (`/product/(.*)`), not a bare product(.*).
    expect(source).toContain('"/product/(.*)"');
    expect(source).not.toMatch(/"\/product\(\.\*\)"/);
  });

  it("skips session work for static public routes but still authenticates `/` and login", () => {
    const source = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");
    expect(source).toContain("if (isStaticPublicRoute(request))");
    expect(source).toContain("withStaticSecurityHeaders");
    expect(source).toContain("shouldRedirectAuthenticatedHome");
    expect(source).toContain("onLoginPage && authenticated");
    expect(source).toContain('pathname === "/api/boot"');
  });
});
