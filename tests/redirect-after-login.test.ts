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
      query: vi.fn().mockResolvedValue({ isPlatformAdmin: true }),
    };
    await expect(resolvePostLoginPath(convex as never)).resolves.toBe("/platform");
  });

  it("resolvePostLoginPath ignores a previous route", async () => {
    const convex = {
      query: vi.fn().mockResolvedValue({ isPlatformAdmin: false, needsOnboarding: false }),
    };
    await expect(resolvePostLoginPath(convex as never, "/products")).resolves.toBe("/dashboard");
  });

  it("resolvePostLoginPath falls back to dashboard on failure", async () => {
    vi.useFakeTimers();
    const convex = {
      query: vi.fn().mockRejectedValue(new Error("offline")),
    };
    const pending = resolvePostLoginPath(convex as never);
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe("/dashboard");
    vi.useRealTimers();
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

  it("hard Cap login nav clears unload state before location.replace", () => {
    const source = readFileSync(
      resolve(process.cwd(), "lib/auth/redirect-after-login.ts"),
      "utf8",
    );
    expect(source).toContain("export function prepareHardNavigation");
    expect(source).toContain("element.defaultValue = element.value");
    expect(source).toContain("window.onbeforeunload = null");
    expect(source).toContain("prepareHardNavigation()");
    expect(source).toContain("window.location.replace(path)");
  });
});
