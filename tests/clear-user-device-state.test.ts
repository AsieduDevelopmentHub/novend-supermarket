import { describe, expect, it, vi } from "vitest";
import { clearUserDeviceState } from "@/lib/auth/clear-user-device-state";

describe("clearUserDeviceState", () => {
  it("drops session replica keys and keeps device identity", () => {
    const store = new Map<string, string>([
      ["novend.offlineSession", "yes"],
      ["novend.offlineSessions", '[{"userId":"u1"}]'],
      ["novend.license.org.org1", '{"planKey":"lifetime"}'],
      ["novend.offlineUserId", "u1"],
      ["novend.offlineOrganizationId", "org1"],
      ["novend.device.fingerprint", "keep-me"],
      ["novend.terminal.printer", "printer"],
      ["novend.posPreferences", '{"receiptPrintMode":"never"}'],
      ["novend.idleLock.timeoutMinutes", "10"],
    ]);
    const session = new Map<string, string>([["novend.auth.signedOut", "1"]]);
    vi.stubGlobal("localStorage", {
      get length() {
        return store.size;
      },
      key: (index: number) => [...store.keys()][index] ?? null,
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
    vi.stubGlobal("sessionStorage", {
      get length() {
        return session.size;
      },
      key: (index: number) => [...session.keys()][index] ?? null,
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
    });

    clearUserDeviceState();

    expect(store.has("novend.offlineSession")).toBe(false);
    expect(store.has("novend.offlineUserId")).toBe(false);
    expect(store.get("novend.offlineSessions")).toContain("u1");
    expect(store.get("novend.license.org.org1")).toContain("lifetime");
    expect(store.get("novend.device.fingerprint")).toBe("keep-me");
    expect(store.get("novend.terminal.printer")).toBe("printer");
    expect(store.get("novend.posPreferences")).toContain("never");
    expect(store.get("novend.idleLock.timeoutMinutes")).toBe("10");
    expect(session.get("novend.auth.signedOut")).toBe("1");
  });
});
