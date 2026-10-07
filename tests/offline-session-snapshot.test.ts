import { describe, expect, it, vi } from "vitest";
import {
  activateOfflineSession,
  clearOfflineSession,
  ensureActiveOfflineSession,
  forgetOfflineSession,
  getOfflineSessionSnapshot,
  listOfflineSessions,
  markOfflineSession,
  readOfflineSession,
  rememberOfflineSession,
} from "@/lib/offline/session";
import { markExplicitLogout, consumeExplicitLogout } from "@/lib/auth/logout-flag";

function installStorage() {
  const store = new Map<string, string>();
  const session = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
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
  vi.stubGlobal("window", {
    localStorage: globalThis.localStorage,
    sessionStorage: globalThis.sessionStorage,
    dispatchEvent: () => true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
  return store;
}

describe("offline session snapshot", () => {
  it("does not extend online authority when an account is activated offline", () => {
    installStorage();
    const now = Date.now();
    const savedAt = now - 29 * 24 * 60 * 60 * 1000;
    markOfflineSession({
      userId: "expiry",
      name: "Ada",
      role: "cashier",
      branchId: "b1",
      branchName: "Main",
      savedAt,
    });
    expect(activateOfflineSession("expiry")?.savedAt).toBe(savedAt);
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 2 * 24 * 60 * 60 * 1000);
    try {
      // Storage is unchanged: cached snapshots must still enforce the TTL.
      expect(getOfflineSessionSnapshot()).toBeNull();
      expect(listOfflineSessions()).toHaveLength(0);
      expect(ensureActiveOfflineSession()).toBeNull();
    } finally {
      clock.mockRestore();
    }
  });

  it("returns the same object while storage is unchanged", () => {
    installStorage();

    markOfflineSession({
      userId: "u1",
      name: "Ada",
      role: "administrator",
      branchId: "b1",
      branchName: "Main",
      organizationId: "o1",
      savedAt: Date.now(),
    });

    const first = getOfflineSessionSnapshot();
    const second = getOfflineSessionSnapshot();
    const third = readOfflineSession();
    expect(first).toEqual({
      userId: "u1",
      name: "Ada",
      role: "administrator",
      branchId: "b1",
      branchName: "Main",
      organizationId: "o1",
      savedAt: first?.savedAt,
    });
    expect(second).toBe(first);
    expect(third).toBe(first);

    clearOfflineSession();
    expect(getOfflineSessionSnapshot()).toBeNull();
    expect(listOfflineSessions()).toHaveLength(1);
  });

  it("remembers every staff account that signed in on this device", () => {
    installStorage();
    const now = Date.now();
    markOfflineSession({
      userId: "u1",
      name: "Ada",
      role: "administrator",
      branchId: "b1",
      branchName: "Main",
      organizationId: "o1",
      savedAt: now - 1000,
    });
    markOfflineSession({
      userId: "u2",
      name: "Ben",
      role: "cashier",
      branchId: "b1",
      branchName: "Main",
      organizationId: "o1",
      email: "ben@shop.com",
      savedAt: now,
    });

    const listed = listOfflineSessions();
    expect(listed.map((row) => row.userId)).toEqual(["u2", "u1"]);
    expect(getOfflineSessionSnapshot()?.userId).toBe("u2");

    const activated = activateOfflineSession("u1");
    expect(activated?.userId).toBe("u1");
    expect(getOfflineSessionSnapshot()?.userId).toBe("u1");
    expect(listOfflineSessions()).toHaveLength(2);

    forgetOfflineSession("u2");
    expect(listOfflineSessions().map((row) => row.userId)).toEqual(["u1"]);
  });

  it("does not revive an active shell after explicit sign-out", () => {
    installStorage();
    markOfflineSession({
      userId: "u1",
      name: "Ada",
      role: "administrator",
      branchId: "b1",
      branchName: "Main",
      organizationId: "o1",
      savedAt: Date.now(),
    });
    clearOfflineSession();
    markExplicitLogout();

    expect(ensureActiveOfflineSession()).toBeNull();
    expect(getOfflineSessionSnapshot()).toBeNull();
    expect(listOfflineSessions()).toHaveLength(1);

    consumeExplicitLogout();
    expect(ensureActiveOfflineSession()?.userId).toBe("u1");
  });

  it("remembers a created account without switching the signed-in user", () => {
    installStorage();
    markOfflineSession({
      userId: "admin",
      name: "Ada",
      role: "administrator",
      branchId: "b1",
      branchName: "Main",
      organizationId: "o1",
      email: "ada@shop.test",
      savedAt: Date.now(),
    });
    rememberOfflineSession({
      userId: "cashier",
      name: "Kojo",
      role: "cashier",
      branchId: "b1",
      branchName: "Main",
      organizationId: "o1",
      email: "kojo@shop.test",
      savedAt: Date.now(),
    });
    expect(getOfflineSessionSnapshot()?.userId).toBe("admin");
    expect(listOfflineSessions().map((row) => row.userId).sort()).toEqual(["admin", "cashier"]);
    expect(activateOfflineSession("cashier")?.email).toBe("kojo@shop.test");
  });
});
