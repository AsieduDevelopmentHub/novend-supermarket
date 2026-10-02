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
    expect(
      isChunkLoadError(
        new Error(
          "Module 579542 was instantiated because it was required from module 789034, but the module factory is not available.",
        ),
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

  it("SW prefers validated auth cache for fromBoot and signedOut leaves", () => {
    const sw = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    expect(sw).toContain('const CACHE_NAME = "novend-pos-v29"');
    expect(sw).toContain('url.searchParams.get("signedOut") === "1"');
    expect(sw).toContain('url.searchParams.get("fromBoot") === "1"');
    expect(sw).toContain('url.searchParams.get("novendFresh") === "1"');
    expect(sw).toContain("preferCache = !freshLeave && (fromBoot || signedOut)");
    expect(sw).toContain("precacheAuthDocument");
    expect(sw).toContain("?signedOut=1&novendPrecache=1");
    expect(sw).toContain("await isLikelyAuthHtml(normalized)");
    expect(sw).toContain("await warmDocumentStaticAssets(html)");
    expect(sw).toContain("isUsableAuthCache");
    expect(sw).toContain("if (!(await isLikelyAuthHtml(copy)))");
    expect(sw).toContain("if (!(await isUsableAuthCache(hit, expected)))");
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
    expect(source).toContain("Opening sign-in…");
    expect(source).toContain("resumeOfflineShellToDashboard");
    expect(source).toContain("shouldAutoRecoverChunkFailure");
    expect(source).toContain("recoverFromChunkLoadFailure");
    expect(source).toContain("Refresh Novend");
    expect(source).not.toMatch(/asChild[\s\S]*Link href=["']\/dashboard["']/);
  });
});
