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
    expect(sw).toContain("caches.match(expected)");
    expect(sw).toContain("await fetch(request)");
    expect(sw).toContain("precacheAuthDocument");
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
    expect(sw).toContain("const FINAL_URL_HEADER");
    expect(sw).toContain("function responseFinalUrl");
    expect(sw).toContain("finalResponseUrl && isLoginDocumentUrl(finalResponseUrl)");
  });

  it("leaves JSON /api/ unintercepted but can cache /api/boot for older Capacitor APKs", () => {
    expect(sw).toContain('url.pathname.startsWith("/api/")');
    expect(sw).toContain('url.pathname !== "/api/boot"');
  });

  it("uses network-first for documents, cache-first on fromBoot or fromLogin shell warm", () => {
    expect(sw).toContain("function networkFirstDocument");
    expect(sw).toContain("function cacheFirstDocument");
    expect(sw).toContain("function isShellWarmNavigation");
    expect(sw).toContain('url.searchParams.get("fromLogin") === "1"');
    expect(sw).not.toContain("staleWhileRevalidate");
  });

  it("never uses the marketing homepage as an app-shell fallback", () => {
    expect(sw).toContain("const APP_SHELL_FALLBACKS");
    expect(sw).toContain("function isMarketingPathname");
    expect(sw).not.toMatch(/APP_SHELL_FALLBACKS = \[[^\]]*\"\/\"/);
    expect(sw).not.toContain('? ["/platform", "/dashboard", "/sales", "/"]');
  });

  it("does not precache gated app routes that 302 to login", () => {
    expect(sw).toContain('const CACHE_NAME = "novend-pos-v26"');
    expect(sw).toContain("/branding/logo_horizontal.png");
    expect(sw).toContain("function matchStaticAsset");
    expect(sw).toContain("ignoreSearch: true");
    expect(sw).toContain("/docs/releases");
    expect(sw).toContain('"/pricing"');
    expect(sw).toContain('"/product"');
    expect(sw).toContain('"/demo"');
    expect(sw).toContain('exactOrChild("/product")');
    expect(sw).toContain('exactOrChild("/demo")');
    expect(sw).toContain("precacheAuthDocument");
    expect(sw).toContain("AUTH_PRECACHE");
    expect(sw).not.toMatch(/PRECACHE = \[[^\]]*\/dashboard/);
    expect(sw).not.toMatch(/PRECACHE = \[[^\]]*\"\/\"/);
    // Must not use startsWith("/product") — that also matches /products.
    expect(sw).not.toMatch(/pathname\.startsWith\("\/product"\)/);
  });

  it("bounds hung document fetches so post-login cannot strand the login skeleton", () => {
    expect(sw).toContain("NETWORK_DOCUMENT_BUDGET_MS");
    expect(sw).toContain("document-network-budget");
    expect(sw).toContain("auth-redirect-without-shell-cache");
  });

  it("migrates warmed shells and Next static assets on CACHE_NAME bump", () => {
    expect(sw).toContain("function migrateShellCaches");
    expect(sw).toContain("function shouldMigrateCacheEntry");
    expect(sw).toContain("MIGRATE_SHELL_PATHS");
    expect(sw).toContain('"/dashboard"');
    expect(sw).toContain('url.pathname.startsWith("/_next/static/")');
    expect(sw).toContain("await migrateShellCaches(stale)");
    expect(sw).toContain("function isLikelyAuthHtml");
  });

  it("co-caches /_next/static assets when storing shell HTML", () => {
    expect(sw).toContain("function warmDocumentStaticAssets");
    expect(sw).toContain("function extractNextStaticUrls");
    expect(sw).toContain("await warmDocumentStaticAssets(html)");
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

  it("Electron offline-boot defaults to the production POS host", () => {
    expect(electronBoot).toContain("https://dashboard.novendpos.app");
    expect(electronBoot).not.toContain(
      'params.get("appUrl") || "https://novend-pos.vercel.app"',
    );
  });
});
