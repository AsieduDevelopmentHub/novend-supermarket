import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { postLoginPath } from "@/lib/auth/post-login-path";
import {
  consumeSkipStartupSplash,
  markSkipStartupSplash,
  prepareHardNavigation,
  resolvePostLoginPath,
} from "@/lib/auth/redirect-after-login";

describe("redirect-after-login", () => {
  it("resolvePostLoginPath uses live me when available", async () => {
    const convex = {
      query: vi.fn().mockResolvedValue({ userId: "u1", isPlatformAdmin: true }),
    };
    await expect(resolvePostLoginPath(convex as never)).resolves.toBe("/platform");
  });

  it("resolvePostLoginPath ignores a previous route", async () => {
    const convex = {
      query: vi
        .fn()
        .mockResolvedValue({ userId: "u1", isPlatformAdmin: false, needsOnboarding: false }),
    };
    await expect(resolvePostLoginPath(convex as never, "/products")).resolves.toBe("/dashboard");
  });

  it("resolvePostLoginPath fails closed when live me cannot load", async () => {
    vi.useFakeTimers();
    const convex = {
      query: vi.fn().mockRejectedValue(new Error("offline")),
    };
    const pending = resolvePostLoginPath(convex as never);
    const expectation = expect(pending).rejects.toThrow(/profile|offline/i);
    await vi.runAllTimersAsync();
    await expectation;
    vi.useRealTimers();
  });

  it("resolvePostLoginPath rejects when live email does not match the form", async () => {
    const convex = {
      query: vi.fn().mockResolvedValue({
        userId: "u1",
        email: "other@shop.com",
        isPlatformAdmin: false,
        needsOnboarding: false,
      }),
    };
    await expect(
      resolvePostLoginPath(convex as never, null, { expectedEmail: "ben@shop.com" }),
    ).rejects.toThrow(/account mismatch/i);
  });

  it("skip splash flag is one-shot", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });

    markSkipStartupSplash();
    expect(consumeSkipStartupSplash()).toBe(true);
    expect(consumeSkipStartupSplash()).toBe(false);
  });

  it("postLoginPath(null) still lands on dashboard", () => {
    expect(postLoginPath(null)).toBe("/dashboard");
  });

  it("prepareHardNavigation is a no-op without a document", () => {
    expect(() => prepareHardNavigation()).not.toThrow();
  });

  it("dashboard does not assume cashier when the role is still unknown", () => {
    const source = readFileSync(resolve(process.cwd(), "hooks/use-dashboard-data.ts"), "utf8");
    expect(source).not.toContain('?? "cashier"');
    expect(source).toContain("if (!role)");
    const view = readFileSync(
      resolve(process.cwd(), "features/dashboard/components/dashboard-view.tsx"),
      "utf8",
    );
    expect(view).toContain("if (!role || loading || !data)");
  });

  it("startup splash does not consume the skip flag during render", () => {
    const source = readFileSync(resolve(process.cwd(), "providers/startup-splash.tsx"), "utf8");
    expect(source).not.toContain('typeof window !== "undefined" ? consumeSkipStartupSplash()');
    expect(source).toContain("if (!consumeSkipStartupSplash()) return;");
  });

  it("hard Cap login nav clears unload state before location.replace", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/auth/redirect-after-login.ts"), "utf8");
    expect(source).toContain("export function prepareHardNavigation");
    expect(source).toContain("element.defaultValue = element.value");
    expect(source).toContain("window.onbeforeunload = null");
    expect(source).toContain("prepareHardNavigation()");
    expect(source).toContain("window.location.replace(path)");
    expect(source).toContain("await saveShellProfile(");
  });

  it("onboarding binds the replica and skips splash before dashboard", () => {
    const source = readFileSync(
      resolve(process.cwd(), "features/auth/components/onboarding-form.tsx"),
      "utf8",
    );
    expect(source).toContain("resolvePostLoginPath(convex)");
    expect(source).toContain("navigateAfterLogin(path, router)");
    expect(source).not.toContain('router.replace("/dashboard")');
  });

  it("hard nav fallback includes a stalled onboarding page", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/auth/redirect-after-login.ts"), "utf8");
    expect(source).toContain('here === "/onboarding"');
  });

  it("app shell paints a cached session before Convex me settles", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(app)/app-layout-client.tsx"), "utf8");
    expect(source).toContain("allowCachedShell && resolvedCache && !liveReady");
    expect(source).toContain("resolvedCache?.organizationId && resolvedCache.userId");
  });
});
