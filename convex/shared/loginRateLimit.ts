export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
export const LOGIN_DEVICE_FAILURE_LIMIT = 5;
export const LOGIN_MAX_DEVICE_BUCKETS = 8;

export const GENERIC_LOGIN_ERROR =
  "Sign in failed. Check your email and password, or wait before trying again.";

export type LoginDeviceBucket = {
  key: string;
  failedCount: number;
  windowStartedAt: number;
  lockedUntil?: number;
};

export type LoginAttemptState = {
  failedCount: number;
  windowStartedAt: number;
  lockedUntil?: number;
  deviceBuckets?: LoginDeviceBucket[];
};

export type LoginLimitDecision = {
  allowed: boolean;
  delayMs: number;
  retryAfterMs: number;
};

function activeLockRetryMs(lockedUntil: number | undefined, now: number): number {
  return typeof lockedUntil === "number" && lockedUntil > now ? lockedUntil - now : 0;
}

function normalizeAttemptState(state: LoginAttemptState, now: number): LoginAttemptState {
  const deviceBuckets = (state.deviceBuckets ?? []).map((bucket) => {
    if (now - bucket.windowStartedAt < LOGIN_FAILURE_WINDOW_MS) return bucket;
    return {
      key: bucket.key,
      failedCount: 0,
      windowStartedAt: now,
      ...(activeLockRetryMs(bucket.lockedUntil, now) > 0
        ? { lockedUntil: bucket.lockedUntil }
        : {}),
    };
  });
  if (now - state.windowStartedAt < LOGIN_FAILURE_WINDOW_MS) {
    return { ...state, deviceBuckets };
  }
  return {
    failedCount: 0,
    windowStartedAt: now,
    ...(activeLockRetryMs(state.lockedUntil, now) > 0 ? { lockedUntil: state.lockedUntil } : {}),
    deviceBuckets,
  };
}

function progressiveDelayMs(failedCount: number): number {
  if (failedCount <= 0) return 0;
  return Math.min(2_000, 250 * 2 ** (failedCount - 1));
}

export function loginLimitDecision(
  input: LoginAttemptState | null,
  deviceKey: string,
  now = Date.now(),
): LoginLimitDecision {
  if (!input) return { allowed: true, delayMs: 0, retryAfterMs: 0 };
  const state = normalizeAttemptState(input, now);
  const bucket = state.deviceBuckets?.find((candidate) => candidate.key === deviceKey);
  const retryAfterMs = Math.max(
    activeLockRetryMs(state.lockedUntil, now),
    activeLockRetryMs(bucket?.lockedUntil, now),
  );
  return {
    allowed: retryAfterMs === 0,
    delayMs:
      retryAfterMs > 0
        ? 0
        : progressiveDelayMs(Math.max(bucket?.failedCount ?? 0, Math.floor(state.failedCount / 5))),
    retryAfterMs,
  };
}

export function recordLoginFailure(
  input: LoginAttemptState | null,
  deviceKey: string,
  now = Date.now(),
): LoginAttemptState {
  const state = normalizeAttemptState(
    input ?? { failedCount: 0, windowStartedAt: now, deviceBuckets: [] },
    now,
  );
  const buckets = [...(state.deviceBuckets ?? [])];
  const existingIndex = buckets.findIndex((candidate) => candidate.key === deviceKey);
  const current =
    existingIndex >= 0
      ? buckets[existingIndex]
      : { key: deviceKey, failedCount: 0, windowStartedAt: now };
  const bucket =
    now - current.windowStartedAt >= LOGIN_FAILURE_WINDOW_MS
      ? { key: deviceKey, failedCount: 1, windowStartedAt: now }
      : {
          ...current,
          failedCount: current.failedCount + 1,
        };
  if (bucket.failedCount >= LOGIN_DEVICE_FAILURE_LIMIT) {
    bucket.lockedUntil = now + LOGIN_LOCKOUT_MS;
  }
  if (existingIndex >= 0) {
    buckets[existingIndex] = bucket;
  } else {
    buckets.push(bucket);
  }

  const failedCount = state.failedCount + 1;
  return {
    failedCount,
    windowStartedAt: state.windowStartedAt,
    ...(activeLockRetryMs(state.lockedUntil, now) > 0 ? { lockedUntil: state.lockedUntil } : {}),
    deviceBuckets: buckets
      .sort((left, right) => right.windowStartedAt - left.windowStartedAt)
      .slice(0, LOGIN_MAX_DEVICE_BUCKETS),
  };
}

export function normalizeLoginDeviceKey(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim();
  return /^[a-zA-Z0-9_-]{16,128}$/.test(normalized) ? normalized : "unknown";
}
