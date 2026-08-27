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

  it("does not intercept Capacitor WebView requests", () => {
    expect(sw).toContain("NovendCapacitor");
  });

  it("leaves /api/ unintercepted so /api/boot can unregister a poisoned worker", () => {
    expect(sw).toContain('url.pathname.startsWith("/api/")');
  });

  it("uses network-first for documents, not cache-first HTML", () => {
    expect(sw).toContain("function networkFirstDocument");
    expect(sw).not.toContain("staleWhileRevalidate");
  });

  it("does not precache gated app routes that 302 to login", () => {
    expect(sw).toContain('const CACHE_NAME = "novend-pos-v9"');
    expect(sw).not.toMatch(/PRECACHE = \[[^\]]*\/dashboard/);
  });
});

describe("boot health probe", () => {
  it("does not send Cache-Control via fetch cache mode (avoids CORS preflight)", () => {
    expect(boot).not.toContain('cache: "no-store"');
    expect(electronBoot).not.toContain('cache: "no-store"');
    expect(boot).toContain("/api/health?boot=");
    expect(electronBoot).toContain("/api/health?boot=");
  });
});
