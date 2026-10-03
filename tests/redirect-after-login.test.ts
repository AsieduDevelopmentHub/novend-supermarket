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

  it("resolvePostLoginPath rejects when expected email is set but me.email is missing", async () => {
    const convex = {
      query: vi.fn().mockResolvedValue({
        userId: "u1",
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

  it("startup splash skips on fromLogin without consuming sessionStorage during render", () => {
    const source = readFileSync(resolve(process.cwd(), "providers/startup-splash.tsx"), "utf8");
    expect(source).not.toContain('typeof window !== "undefined" ? consumeSkipStartupSplash()');
    expect(source).toContain("if (!consumeSkipStartupSplash()) return;");
    expect(source).toContain('FROM_LOGIN_PARAM');
    expect(source).toContain("fromLogin");
    expect(source).toContain("stripFromLoginParam");
  });

  it("hard Cap login nav clears unload state before location.replace", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/auth/redirect-after-login.ts"), "utf8");
    expect(source).toContain("export function prepareHardNavigation");
    expect(source).toContain("element.defaultValue = element.value");
    expect(source).toContain("window.onbeforeunload = null");
    expect(source).toContain("form.reset()");
    expect(source).toContain("prepareHardNavigation()");
    expect(source).toContain("window.location.replace(target)");
    expect(source).toContain("if (hardNavigationPending) return;");
    const hardBranch = source
      .split('if (typeof window !== "undefined" && forceHard) {')[1]
      ?.split("router.replace(target);")[0];
    expect(hardBranch).toBeTruthy();
    expect(hardBranch?.match(/window\.location\.replace\(target\)/g)).toHaveLength(1);
    expect(hardBranch).not.toContain("window.setTimeout");
    expect(source).not.toContain("window.location.href = target");
    expect(source).toContain("withPostLoginShellMarker");
    expect(source).toContain("fromLogin=1");
    expect(source).toContain("saveShellProfile({");
    expect(source).toContain("SHELL_PROFILE_BUDGET_MS");
  });

  it("login form shows opening cover before hard-navigate while keeping inputs mounted", () => {
    const source = readFileSync(
      resolve(process.cwd(), "features/auth/components/login-form.tsx"),
      "utf8",
    );
    expect(source).toContain("navigateAfterLogin");
    expect(source).toContain("setOpeningWorkspace(true)");
    expect(source).toMatch(/setOpeningWorkspace\(true\);[\s\S]*?navigateAfterLogin/);
    expect(source).toContain("Opening workspace…");
    expect(source).toContain("markPostLoginLeavePending()");
    expect(source).not.toContain('toast.success("Welcome")');
    // Inputs stay in the DOM so prepareHardNavigation can clear leave-site dirt.
    expect(source).toContain('aria-hidden={openingWorkspace}');
  });

  it("post-login leave latch blocks parallel hard leaves", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/auth/redirect-after-login.ts"), "utf8");
    expect(source).toContain("export function markPostLoginLeavePending");
    expect(source).toContain("export function isPostLoginLeavePending");
    expect(source).toContain("export function clearPostLoginLeavePending");
    expect(source).toContain("markPostLoginLeavePending()");
  });

  it("login page mounts a single LoginForm via viewport chrome", () => {
    const page = readFileSync(resolve(process.cwd(), "app/(auth)/login/page.tsx"), "utf8");
    const chrome = readFileSync(
      resolve(process.cwd(), "features/auth/components/login-page-chrome.tsx"),
      "utf8",
    );
    expect(page).toContain("LoginPageChrome");
    expect(page).not.toContain("<LoginForm");
    expect(chrome).toContain("<LoginForm");
    expect(chrome.match(/<LoginForm/g)).toHaveLength(2); // compact + desktop branches, one mount
    expect(chrome).toContain('matchMedia("(min-width: 768px)")');
  });

  it("prepareHardNavigation clears leave-site dirt without detaching React DOM", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/auth/redirect-after-login.ts"), "utf8");
    expect(source).toContain("form.reset()");
    expect(source).not.toContain("form.remove()");
    expect(source).toContain("removeChild");
  });

  it("resolvePostLoginSession returns userId for offline digest storage", async () => {
    const convex = {
      query: vi.fn().mockResolvedValue({
        userId: "u1",
        email: "ben@shop.com",
        isPlatformAdmin: true,
      }),
    };
    const { resolvePostLoginSession } = await import("@/lib/auth/redirect-after-login");
    await expect(
      resolvePostLoginSession(convex as never, null, { expectedEmail: "ben@shop.com" }),
    ).resolves.toEqual({ path: "/platform", userId: "u1" });
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
    // Platform session React state must not update during render (crashed /platform).
    expect(source).toContain("setPlatformSession(next)");
    expect(source).not.toMatch(
      /if \(!cloudIdentityUnsafe && user\?\.isPlatformAdmin[\s\S]*?setPlatformSession\(next\)/,
    );
  });

  it("app shell redirects to login through one hard-navigation owner", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(app)/app-layout-client.tsx"), "utf8");
    expect(source).toContain("loginRedirectStarted");
    expect(source).toContain("if (loginRedirectStarted.current || hasExplicitLogout()) return;");
    expect(source.match(/window\.location\.replace\(/g)).toHaveLength(1);
    expect(source).not.toContain('router.replace("/login")');
    expect(source).not.toContain("const hardNav = window.setTimeout");
    expect(source).toContain("Rendering stays pure");
  });
});
