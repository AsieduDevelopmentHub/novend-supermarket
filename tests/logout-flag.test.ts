import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  consumeExplicitLogout,
  hasExplicitLogout,
  markExplicitLogout,
} from "@/lib/auth/logout-flag";

describe("explicit logout flag", () => {
  it("blocks session resume until consumed", () => {
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

    expect(hasExplicitLogout()).toBe(false);
    markExplicitLogout();
    expect(hasExplicitLogout()).toBe(true);
    expect(consumeExplicitLogout()).toBe(true);
    expect(hasExplicitLogout()).toBe(false);
  });

  it("clears Dexie identity before a hard login navigation", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/auth/sign-out.ts"), "utf8");
    expect(source).toContain("await clearShellProfile()");
    expect(source).toContain('window.location.replace("/login?signedOut=1")');
    expect(source).toContain("markExplicitLogout()");
    expect(source).not.toContain("router.refresh()");
    expect(source).not.toContain("router.replace(");
  });

  it("does not cover login with Convex isLoading", () => {
    const source = readFileSync(
      resolve(process.cwd(), "features/auth/components/login-session-gate.tsx"),
      "utf8",
    );
    expect(source).not.toContain("coverWhileLoading");
    expect(source).toContain("mounted && !explicitLogout && isAuthenticated");
  });

  it("does not query billing or users.me without a Convex session", () => {
    const license = readFileSync(resolve(process.cwd(), "hooks/use-license.ts"), "utf8");
    expect(license).toContain("isAuthenticated && online ? {} : \"skip\"");
    const permissions = readFileSync(resolve(process.cwd(), "hooks/use-permissions.ts"), "utf8");
    expect(permissions).toContain("isAuthenticated && online ? {} : \"skip\"");
    const layout = readFileSync(resolve(process.cwd(), "app/(app)/layout.tsx"), "utf8");
    expect(layout).toContain("if (hasExplicitLogout()) return;");
    expect(layout).toContain('return <AppSplash label="Signing out…" />');
  });
});
