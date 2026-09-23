import { describe, expect, it, vi } from "vitest";
import {
  createIdleLockState,
  DEFAULT_IDLE_LOCK_TIMEOUT_MINUTES,
  IDLE_LOCK_TIMEOUT_KEY,
  lockIdleWorkspace,
  parseIdleLockTimeout,
  readIdleLockTimeout,
  recordIdleActivity,
  shouldLockAfterIdle,
  tickIdleLock,
  unlockIdleWorkspace,
  writeIdleLockTimeout,
} from "@/lib/offline/idle-lock";
import { clearUserDeviceState } from "@/lib/auth/clear-user-device-state";

describe("idle lock state machine", () => {
  it("defaults to a sensible shared-till timeout", () => {
    expect(DEFAULT_IDLE_LOCK_TIMEOUT_MINUTES).toBe(10);
    expect(parseIdleLockTimeout("off")).toBe(10);
    expect(parseIdleLockTimeout(0)).toBe(0);
    expect(parseIdleLockTimeout(15)).toBe(15);
  });

  it("does not lock when timeout is Off", () => {
    const state = createIdleLockState(0, 1_000);
    expect(shouldLockAfterIdle(state, 1_000 + 60 * 60_000)).toBe(false);
    expect(tickIdleLock(state, 1_000 + 60 * 60_000)).toBe(state);
  });

  it("locks after the configured idle window", () => {
    const started = 10_000;
    let state = createIdleLockState(5, started);
    expect(shouldLockAfterIdle(state, started + 4 * 60_000)).toBe(false);
    expect(shouldLockAfterIdle(state, started + 5 * 60_000)).toBe(true);
    state = tickIdleLock(state, started + 5 * 60_000);
    expect(state.phase).toBe("locked");
    expect(state.lockedAt).toBe(started + 5 * 60_000);
  });

  it("activity while unlocked resets the idle timer", () => {
    const started = 10_000;
    let state = createIdleLockState(5, started);
    state = recordIdleActivity(state, started + 4 * 60_000);
    expect(shouldLockAfterIdle(state, started + 5 * 60_000)).toBe(false);
    expect(shouldLockAfterIdle(state, started + 4 * 60_000 + 5 * 60_000)).toBe(true);
  });

  it("ignores activity while locked until unlock", () => {
    const started = 10_000;
    let state = lockIdleWorkspace(createIdleLockState(10, started), started + 1);
    state = recordIdleActivity(state, started + 2);
    expect(state.phase).toBe("locked");
    state = unlockIdleWorkspace(state, started + 3);
    expect(state.phase).toBe("unlocked");
    expect(state.lockedAt).toBeNull();
    expect(state.lastActivityAt).toBe(started + 3);
  });

  it("persists timeout preference and keeps it across logout cleanup", () => {
    const store = new Map<string, string>([
      ["novend.offlineSession", "yes"],
      [IDLE_LOCK_TIMEOUT_KEY, "15"],
      ["novend.device.fingerprint", "keep-me"],
    ]);
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
        return 0;
      },
      key: () => null,
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal("window", {
      localStorage: globalThis.localStorage,
      sessionStorage: globalThis.sessionStorage,
      dispatchEvent: () => true,
    });

    writeIdleLockTimeout(15);
    expect(readIdleLockTimeout()).toBe(15);
    clearUserDeviceState();
    expect(store.has("novend.offlineSession")).toBe(false);
    expect(store.get(IDLE_LOCK_TIMEOUT_KEY)).toBe("15");
    expect(store.get("novend.device.fingerprint")).toBe("keep-me");
  });
});
