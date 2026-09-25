import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  clearLocalAuthVerifier,
  storeLocalAuthVerifier,
  verifyLocalAuth,
} from "@/lib/offline/local-auth";

const loginForm = readFileSync(
  resolve(process.cwd(), "features/auth/components/login-form.tsx"),
  "utf8",
);
const offlineSync = readFileSync(
  resolve(process.cwd(), "docs/architecture/OFFLINE_SYNC.md"),
  "utf8",
);
const signOut = readFileSync(resolve(process.cwd(), "lib/auth/sign-out.ts"), "utf8");
const layout = readFileSync(resolve(process.cwd(), "app/(app)/app-layout-client.tsx"), "utf8");

describe("offline email+password resume", () => {
  it("uses raw email+password form — no Continue offline account cards", () => {
    expect(loginForm).toContain("verifyLocalAuth");
    expect(loginForm).toContain("storeLocalAuthVerifier");
    expect(loginForm).not.toContain("Continue offline");
    expect(loginForm).not.toContain("listOfflineSessions().map");
    expect(loginForm).not.toContain("Users");
  });

  it("navigates offline sign-out without awaiting a hung Convex signOut", () => {
    expect(signOut).toContain("isLikelyOffline");
    expect(signOut).toContain("await navigateToLoginAfterSignOut()");
    expect(signOut).toMatch(/if \(isLikelyOffline\(\)\)[\s\S]*navigateToLoginAfterSignOut/);
  });

  it("sends offline empty shell to login instead of Can't start while offline", () => {
    expect(layout).toContain('label="Opening sign-in…"');
    expect(layout).toContain('next.searchParams.set("fromBoot", "1")');
    expect(layout).not.toContain('title="Can\'t start while offline"');
  });

  it("documents device digest unlock for offline login", () => {
    expect(offlineSync).toContain("device-local password digest");
    expect(offlineSync).toContain("password form");
    expect(offlineSync).toContain("PBKDF2");
  });
});

describe("local auth verifier", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts the correct password and rejects a wrong one", async () => {
    await storeLocalAuthVerifier("cashier@shop.test", "Secret123!", "user_1");
    await expect(verifyLocalAuth("cashier@shop.test", "Secret123!")).resolves.toEqual({
      userId: "user_1",
      email: "cashier@shop.test",
    });
    await expect(verifyLocalAuth("cashier@shop.test", "wrong")).resolves.toBeNull();
    clearLocalAuthVerifier("cashier@shop.test");
    await expect(verifyLocalAuth("cashier@shop.test", "Secret123!")).resolves.toBeNull();
  });
});
