/**
 * Shared-till inactivity lock — device preference + pure state machine.
 * Password unlock reuses Convex Auth; biometrics are optional when native APIs exist.
 * Does not encrypt Dexie; it only obscures the UI until reauthentication.
 */

export const IDLE_LOCK_TIMEOUT_KEY = "novend.idleLock.timeoutMinutes";
/** Same-tab notification when Settings changes the idle timeout. */
export const IDLE_LOCK_TIMEOUT_EVENT = "novend-idle-lock-timeout";

/** Minutes of inactivity before the workspace locks. `0` = Off. */
export type IdleLockTimeoutMinutes = 0 | 5 | 10 | 15 | 30;

export const IDLE_LOCK_TIMEOUT_OPTIONS: ReadonlyArray<{
  value: IdleLockTimeoutMinutes;
  label: string;
}> = [
  { value: 0, label: "Off" },
  { value: 5, label: "5 minutes" },
  { value: 10, label: "10 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
];

/** Default for shared tills: lock after 10 minutes of inactivity. */
export const DEFAULT_IDLE_LOCK_TIMEOUT_MINUTES: IdleLockTimeoutMinutes = 10;

export type IdleLockPhase = "unlocked" | "locked";

export type IdleLockState = {
  phase: IdleLockPhase;
  timeoutMinutes: IdleLockTimeoutMinutes;
  lastActivityAt: number;
  lockedAt: number | null;
};

export function parseIdleLockTimeout(raw: unknown): IdleLockTimeoutMinutes {
  const n = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  if (n === 0 || n === 5 || n === 10 || n === 15 || n === 30) return n;
  return DEFAULT_IDLE_LOCK_TIMEOUT_MINUTES;
}

export function readIdleLockTimeout(): IdleLockTimeoutMinutes {
  if (typeof window === "undefined") return DEFAULT_IDLE_LOCK_TIMEOUT_MINUTES;
  try {
    return parseIdleLockTimeout(window.localStorage.getItem(IDLE_LOCK_TIMEOUT_KEY));
  } catch {
    return DEFAULT_IDLE_LOCK_TIMEOUT_MINUTES;
  }
}

export function writeIdleLockTimeout(minutes: IdleLockTimeoutMinutes): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(IDLE_LOCK_TIMEOUT_KEY, String(minutes));
  } catch {
    /* private mode */
  }
  try {
    window.dispatchEvent(new CustomEvent(IDLE_LOCK_TIMEOUT_EVENT, { detail: minutes }));
  } catch {
    /* jsdom / private */
  }
}

export function createIdleLockState(
  timeoutMinutes: IdleLockTimeoutMinutes = readIdleLockTimeout(),
  now = Date.now(),
): IdleLockState {
  return {
    phase: "unlocked",
    timeoutMinutes,
    lastActivityAt: now,
    lockedAt: null,
  };
}

export function shouldLockAfterIdle(state: IdleLockState, now: number): boolean {
  if (state.phase !== "unlocked") return false;
  if (state.timeoutMinutes <= 0) return false;
  const idleMs = state.timeoutMinutes * 60_000;
  return now - state.lastActivityAt >= idleMs;
}

export function recordIdleActivity(state: IdleLockState, now: number): IdleLockState {
  if (state.phase === "locked") return state;
  return { ...state, lastActivityAt: now };
}

export function setIdleLockTimeout(
  state: IdleLockState,
  timeoutMinutes: IdleLockTimeoutMinutes,
): IdleLockState {
  return { ...state, timeoutMinutes };
}

export function lockIdleWorkspace(state: IdleLockState, now: number): IdleLockState {
  if (state.phase === "locked") return state;
  return {
    ...state,
    phase: "locked",
    lockedAt: now,
  };
}

export function unlockIdleWorkspace(state: IdleLockState, now: number): IdleLockState {
  return {
    ...state,
    phase: "unlocked",
    lastActivityAt: now,
    lockedAt: null,
  };
}

/** Advance the machine on a timer tick. Returns the same reference when unchanged. */
export function tickIdleLock(state: IdleLockState, now: number): IdleLockState {
  if (!shouldLockAfterIdle(state, now)) return state;
  return lockIdleWorkspace(state, now);
}
