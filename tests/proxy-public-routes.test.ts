import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("proxy public routes", () => {
  it("retires marketing pricing/product into the login redirect matcher", () => {
    const source = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");

    expect(source).toContain("isRetiredPublicPath");
    expect(source).toContain('"/pricing"');
    expect(source).toContain('"/pricing/(.*)"');
    expect(source).toContain('"/product"');
    expect(source).toContain('"/product/(.*)"');
    expect(source).toContain('"/contact"');
    expect(source).toContain('"/contact/(.*)"');
    expect(source).toContain('"/demo"');
    expect(source).toContain('"/demo/(.*)"');
    expect(source).toContain('"/wholesale(.*)"');
    expect(source).toContain('"/branches(.*)"');
    expect(source).toContain("isStaticPublicRoute");
    expect(source).toContain("isPublicRoute");

    // Matcher entries are segment-bounded (`/product/(.*)`), not a bare product(.*).
    expect(source).toContain('"/product/(.*)"');
    expect(source).not.toMatch(/"\/product\(\.\*\)"/);
  });

  it("redirects retired public paths to login or dashboard", () => {
    const source = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");
    expect(source).toContain("if (isRetiredPublicPath(request))");
    expect(source).toContain("if (isStaticPublicRoute(request))");
    expect(source).toContain("withStaticSecurityHeaders");
    expect(source).toContain('redirectTo(request, "/login")');
    expect(source).toContain('redirectTo(request, "/dashboard")');
    expect(source).toContain("onLoginPage && authenticated");
    expect(source).toContain('searchParams.get("shellBack") === "1"');
    expect(source).toContain('pathname === "/api/boot"');
  });

  it("allows Continue locally app shell through without a JWT", () => {
    const source = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");
    expect(source).toContain('LOCAL_ONLY_CLOUD_COOKIE = "novend_local_only"');
    expect(source).toContain("hasLocalOnlyShellCookie(request) && !isPlatformRoute(request)");
  });
});
