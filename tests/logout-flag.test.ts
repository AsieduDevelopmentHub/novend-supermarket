import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  clearSigningOutUi,
  consumeExplicitLogout,
  hasExplicitLogout,
  isSigningOutUi,
  markExplicitLogout,
} from "@/lib/auth/logout-flag";

describe("explicit logout flag", () => {
  it("blocks session resume until consumed", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", storage);

    expect(hasExplicitLogout()).toBe(false);
    expect(isSigningOutUi()).toBe(false);
    markExplicitLogout();
    expect(hasExplicitLogout()).toBe(true);
    expect(isSigningOutUi()).toBe(true);
    expect(consumeExplicitLogout()).toBe(true);
    expect(hasExplicitLogout()).toBe(false);
    expect(isSigningOutUi()).toBe(false);
  });

  it("keeps the security barrier after clearing the Signing out UI on reload", () => {
    const local = new Map<string, string>();
    const session = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => local.get(key) ?? null,
      setItem: (key: string, value: string) => {
        local.set(key, value);
      },
      removeItem: (key: string) => {
        local.delete(key);
      },
    });
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => {
        session.set(key, value);
      },
      removeItem: (key: string) => {
        session.delete(key);
      },
    });

    markExplicitLogout();
    expect(hasExplicitLogout()).toBe(true);
    expect(isSigningOutUi()).toBe(true);
    clearSigningOutUi();
    expect(isSigningOutUi()).toBe(false);
    expect(hasExplicitLogout()).toBe(true);
  });

  it("clears session keys before a hard login navigation (replicas stay for dual-account offline)", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/auth/sign-out.ts"), "utf8");
    expect(source).toContain("clearOfflineSession()");
    expect(source).toContain("clearUserDeviceState()");
    expect(source).toContain("clearCartDraft()");
    expect(source).toContain("clearCustomerDisplaySnapshot()");
    expect(source).toContain("navigateToLoginAfterSignOut()");
    expect(source).toContain("markExplicitLogout()");
    expect(source).toContain("shouldSkipAwaitingCloudSignOut");
    // Logout marker must be set *after* device wipe or sign-out revives the shell.
    expect(source.indexOf("clearUserDeviceState()")).toBeLessThan(
      source.indexOf("markExplicitLogout()"),
    );
    expect(source).not.toContain("router.refresh()");
    expect(source).not.toContain("router.replace(");
    expect(source).not.toContain("await clearShellProfile()");
  });

  it("documents tenant-safe replica deletion that includes the image cache", () => {
    const db = readFileSync(resolve(process.cwd(), "lib/offline/db.ts"), "utf8");
    expect(db).toContain("shouldDeleteOfflineReplicaOnLogout");
    expect(db).toContain("product image");
    expect(db).toContain("Never delete another tenant");
  });

  it("does not cover login with AppSplash or Convex isLoading", () => {
    const source = readFileSync(
      resolve(process.cwd(), "features/auth/components/login-session-gate.tsx"),
      "utf8",
    );
    expect(source).not.toContain("coverWhileLoading");
    expect(source).not.toContain('from "@/features/auth/components/app-splash"');
    expect(source).not.toContain("<AppSplash");
    expect(source).toContain("fromLogin=1");
    expect(source).toContain("FORCE_LEAVE_BUDGET_MS");
  });

  it("does not query billing or users.me without a Convex session", () => {
    const license = readFileSync(resolve(process.cwd(), "hooks/use-license.ts"), "utf8");
    expect(license).toContain('isAuthenticated && online ? {} : "skip"');
    const permissions = readFileSync(resolve(process.cwd(), "hooks/use-permissions.ts"), "utf8");
    expect(permissions).toContain('isAuthenticated && online ? {} : "skip"');
    const layout = readFileSync(resolve(process.cwd(), "app/(app)/app-layout-client.tsx"), "utf8");
    expect(layout).toContain("hasExplicitLogout");
    expect(layout).toContain("SigningOutSplash");
    expect(layout).toContain('activeLeave ? "Signing out…" : "Opening sign-in…"');
    expect(layout).toContain("return <SigningOutSplash activeLeave={activeSigningOutUi} />");
    expect(layout).toContain("isSigningOutUi()");
  });
});
