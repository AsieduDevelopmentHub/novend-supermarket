import { describe, expect, it, vi } from "vitest";
import {
  clearOfflineSession,
  getOfflineSessionSnapshot,
  markOfflineSession,
  readOfflineSession,
} from "@/lib/offline/session";

describe("offline session snapshot", () => {
  it("returns the same object while storage is unchanged", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
    vi.stubGlobal("window", {
      localStorage: globalThis.localStorage,
      dispatchEvent: () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    });

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
    expect(getOfflineSessionSnapshot()).toBeNull();
  });
});
