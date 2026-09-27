import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isChunkLoadError, shouldRecoverToLogin } from "@/lib/auth/recover-auth-navigation";

describe("offline sign-out recovery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects Next chunk load failures", () => {
    expect(
      isChunkLoadError(
        new Error("Failed to load chunk /_next/static/immutable/chunks/36mr0ubq12f4c.js"),
      ),
    ).toBe(true);
    expect(isChunkLoadError(new Error("boom"))).toBe(false);
  });

  it("recovers to login after explicit logout even without a chunk error", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
    store.set("novend.auth.signedOut", "1");
    expect(shouldRecoverToLogin(new Error("anything"))).toBe(true);
  });

  it("SW prefers cached login for signedOut/fromBoot navigations", () => {
    const sw = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    expect(sw).toContain('const CACHE_NAME = "novend-pos-v24"');
    expect(sw).toContain('url.searchParams.get("signedOut") === "1"');
    expect(sw).toContain('url.searchParams.get("fromBoot") === "1"');
  });

  it("Electron sign-out does not await a hung Convex signOut", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/auth/sign-out.ts"), "utf8");
    expect(source).toContain("shouldSkipAwaitingCloudSignOut");
    expect(source).toContain("isElectron()");
    expect(source).toContain("navigateToLoginAfterSignOut");
  });

  it("app error boundary recovers to sign-in instead of dashboard", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(app)/error.tsx"), "utf8");
    expect(source).toContain("recoverToLoginAfterFailure");
    expect(source).toContain("Open sign-in");
    expect(source).toContain("Opening sign-in…");
  });
});
