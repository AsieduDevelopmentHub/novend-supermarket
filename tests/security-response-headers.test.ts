import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CROSS_ORIGIN_OPENER_POLICY,
  CROSS_ORIGIN_RESOURCE_POLICY,
  PRODUCTION_HSTS,
  applySecurityHeaders,
  buildSecurityHeaders,
} from "@/lib/security/response-headers";

describe("response security headers", () => {
  it("omits HSTS outside production", () => {
    const headers = buildSecurityHeaders({ NODE_ENV: "development" });
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Cross-Origin-Opener-Policy"]).toBe(CROSS_ORIGIN_OPENER_POLICY);
    expect(headers["Cross-Origin-Resource-Policy"]).toBe(CROSS_ORIGIN_RESOURCE_POLICY);
  });

  it("sets production-only HSTS with a one-year max-age", () => {
    const headers = buildSecurityHeaders({ NODE_ENV: "production" });
    expect(headers["Strict-Transport-Security"]).toBe(PRODUCTION_HSTS);
    expect(PRODUCTION_HSTS).toMatch(/max-age=31536000/);
    expect(PRODUCTION_HSTS).toMatch(/includeSubDomains/);
    expect(PRODUCTION_HSTS).not.toMatch(/preload/);
  });

  it("applies headers onto a response-like object", () => {
    const store = new Map<string, string>();
    applySecurityHeaders(
      { headers: { set: (name, value) => store.set(name, value) } },
      { NODE_ENV: "production" },
    );
    expect(store.get("Strict-Transport-Security")).toBe(PRODUCTION_HSTS);
    expect(store.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
  });

  it("keeps CSP nonce wiring and security-header helper in proxy.ts", () => {
    const source = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");
    expect(source).toContain("buildCsp(nonce)");
    expect(source).toContain('requestHeaders.set("x-nonce", nonce)');
    expect(source).toContain("applySecurityHeaders(response)");
    expect(source).not.toMatch(/Cross-Origin-Embedder-Policy/);
  });
});
