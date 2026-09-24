import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sw = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
const boot = readFileSync(resolve(process.cwd(), "apps/mobile/www/index.html"), "utf8");
const electronBoot = readFileSync(resolve(process.cwd(), "apps/desktop/offline-boot.html"), "utf8");

describe("service worker navigation safety", () => {
  it("unwraps redirected responses so Chrome does not paint ERR_FAILED", () => {
    expect(sw).toContain("function unwrapRedirect");
    expect(sw).toContain("response.redirected");
    expect(sw).toContain('redirect: "follow"');
  });

  it("serves auth documents network-first with a cached login fallback offline", () => {
    expect(sw).toContain("function isAuthDocument");
    expect(sw).toContain('url.pathname === "/login"');
    expect(sw).toContain("if (isAuthDocument(url))");
    expect(sw).toContain('caches.match("/login")');
    expect(sw).toContain("await fetch(request)");
  });

  it("does not intercept the marketing homepage so a signed-in 302 can change the URL", () => {
    expect(sw).toContain('if (url.pathname === "/") return;');
    expect(sw).toContain("if (finalUrl.pathname !== requested.pathname) return;");
  });

  it("does not skip Capacitor document fetches so offline boot can use Cache Storage", () => {
    expect(sw).toContain("if (isAppShellRequest(request, url))");
    expect(sw).not.toMatch(/if \(ua\.includes\("NovendCapacitor"\)\) return;/);
  });

  it("never caches a followed login document under an app-shell URL", () => {
    expect(sw).toContain("function isLoginDocumentUrl");
    expect(sw).toContain("if (response.url && isLoginDocumentUrl(response.url)) return;");
  });

  it("leaves JSON /api/ unintercepted but can cache /api/boot for older Capacitor APKs", () => {
    expect(sw).toContain('url.pathname.startsWith("/api/")');
    expect(sw).toContain('url.pathname !== "/api/boot"');
  });

  it("uses network-first for documents, cache-first only on fromBoot cold start", () => {
    expect(sw).toContain("function networkFirstDocument");
    expect(sw).toContain("function cacheFirstDocument");
    expect(sw).toContain("function isColdBootNavigation");
    expect(sw).not.toContain("staleWhileRevalidate");
  });

  it("never uses the marketing homepage as an app-shell fallback", () => {
    expect(sw).toContain("const APP_SHELL_FALLBACKS");
    expect(sw).toContain("function isMarketingPathname");
    expect(sw).not.toMatch(/APP_SHELL_FALLBACKS = \[[^\]]*\"\/\"/);
    expect(sw).not.toContain('? ["/platform", "/dashboard", "/sales", "/"]');
  });

  it("does not precache gated app routes that 302 to login", () => {
    expect(sw).toContain('const CACHE_NAME = "novend-pos-v17"');
    expect(sw).toContain("/branding/logo_horizontal.png");
    expect(sw).toContain("/docs/releases");
    expect(sw).not.toMatch(/PRECACHE = \[[^\]]*\/dashboard/);
    expect(sw).not.toMatch(/PRECACHE = \[[^\]]*\"\/\"/);
  });
});

describe("boot health probe", () => {
  it("Capacitor and Electron boot do not gate on /api/health", () => {
    expect(boot).not.toContain('cache: "no-store"');
    expect(electronBoot).not.toContain('cache: "no-store"');
    expect(boot).not.toContain("/api/health?boot=");
    expect(electronBoot).not.toContain("/api/health?boot=");
    expect(boot).toContain("fromBoot=1");
    expect(electronBoot).toContain("fromBoot=1");
  });
});
