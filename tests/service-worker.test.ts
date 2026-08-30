import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sw = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
const boot = readFileSync(resolve(process.cwd(), "apps/mobile/www/index.html"), "utf8");
const electronBoot = readFileSync(
  resolve(process.cwd(), "apps/desktop/offline-boot.html"),
  "utf8",
);

describe("service worker navigation safety", () => {
  it("unwraps redirected responses so Chrome does not paint ERR_FAILED", () => {
    expect(sw).toContain("function unwrapRedirect");
    expect(sw).toContain("response.redirected");
    expect(sw).toContain('redirect: "follow"');
  });

  it("does not intercept /login so the auth 302 is followed by the browser", () => {
    expect(sw).toContain("function isAuthDocument");
    expect(sw).toContain("url.pathname === \"/login\"");
    expect(sw).toContain("if (isAuthDocument(url)) return;");
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

  it("uses network-first for documents, not cache-first HTML", () => {
    expect(sw).toContain("function networkFirstDocument");
    expect(sw).not.toContain("staleWhileRevalidate");
  });

  it("does not precache gated app routes that 302 to login", () => {
    expect(sw).toContain('const CACHE_NAME = "novend-pos-v10"');
    expect(sw).toContain("/branding/logo_horizontal.png");
    expect(sw).not.toMatch(/PRECACHE = \[[^\]]*\/dashboard/);
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
