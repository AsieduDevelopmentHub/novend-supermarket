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
    expect(source).toContain('const loginHref = "/login?signedOut=1"');
    expect(source).toContain("window.location.replace(loginHref)");
    expect(source).toContain("markExplicitLogout()");
  });
});
