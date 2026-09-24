import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("CSP nonce wiring", () => {
  it("middleware stamps nonce CSP on app/auth requests so Next.js can nonce its scripts", () => {
    const source = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");
    expect(source).toContain('requestHeaders.set("x-nonce", nonce)');
    expect(source).toContain('requestHeaders.set("Content-Security-Policy", buildNonceCsp(nonce))');
    expect(source).toContain("buildStaticMarketingCsp");
    expect(source).toContain("isStaticPublicRoute");
  });

  it("keeps root layout free of headers()/nonce so marketing can stay static-friendly", () => {
    const layout = readFileSync(resolve(process.cwd(), "app/layout.tsx"), "utf8");
    expect(layout).not.toMatch(/from "next\/headers"/);
    expect(layout).not.toMatch(/await headers\(/);
    expect(layout).not.toMatch(/get\("x-nonce"\)/);
    expect(layout).toContain("<AppProviders>");
    expect(layout).toContain("ConvexAuthNextjsServerProvider");
  });

  it("reads the request nonce in app and auth layouts for ThemeBootScript", () => {
    const appLayout = readFileSync(resolve(process.cwd(), "app/(app)/layout.tsx"), "utf8");
    const authLayout = readFileSync(resolve(process.cwd(), "app/(auth)/layout.tsx"), "utf8");
    const siteLayout = readFileSync(resolve(process.cwd(), "app/(site)/layout.tsx"), "utf8");
    const providers = readFileSync(resolve(process.cwd(), "providers/app-providers.tsx"), "utf8");

    for (const layout of [appLayout, authLayout]) {
      expect(layout).toContain('(await headers()).get("x-nonce")');
      expect(layout).toContain("NonceProvider");
      expect(layout).toContain("ThemeBootScript");
    }
    expect(siteLayout).not.toMatch(/from "next\/headers"/);
    expect(providers).toContain("nonce={resolvedNonce}");
  });

  it("does not preload the splash brandmark (short overlay trips unused-preload)", () => {
    const splash = readFileSync(
      resolve(process.cwd(), "features/auth/components/app-splash.tsx"),
      "utf8",
    );
    expect(splash).not.toMatch(/priority/);
  });
});
