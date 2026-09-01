import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("CSP nonce wiring", () => {
  it("middleware stamps CSP on the request so Next.js can nonce its scripts", () => {
    const source = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");
    expect(source).toContain('requestHeaders.set("x-nonce", nonce)');
    expect(source).toContain('requestHeaders.set("Content-Security-Policy", buildCsp(nonce))');
  });

  it("passes the request nonce to next-themes so the boot script is not blocked", () => {
    const layout = readFileSync(resolve(process.cwd(), "app/layout.tsx"), "utf8");
    const providers = readFileSync(resolve(process.cwd(), "providers/app-providers.tsx"), "utf8");
    expect(layout).toContain('(await headers()).get("x-nonce")');
    expect(layout).toContain("<AppProviders nonce={nonce}>");
    expect(providers).toContain("nonce={nonce}");
  });

  it("does not preload the splash brandmark (short overlay trips unused-preload)", () => {
    const splash = readFileSync(
      resolve(process.cwd(), "features/auth/components/app-splash.tsx"),
      "utf8",
    );
    expect(splash).not.toMatch(/priority/);
  });
});
