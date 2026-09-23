import { describe, expect, it } from "vitest";
import {
  GENERIC_LOGIN_ERROR,
  LOGIN_DEVICE_FAILURE_LIMIT,
  LOGIN_FAILURE_WINDOW_MS,
  LOGIN_LOCKOUT_MS,
  loginLimitDecision,
  recordLoginFailure,
  type LoginAttemptState,
} from "@/convex/shared/loginRateLimit";

describe("login abuse controls", () => {
  const now = 1_000_000;

  function fail(
    count: number,
    deviceKey = "device_key_123456",
    state: LoginAttemptState | null = null,
  ): LoginAttemptState {
    let next = state;
    for (let index = 0; index < count; index += 1) {
      next = recordLoginFailure(next, deviceKey, now + index);
    }
    return next!;
  }

  it("locks an email and device after five failures in fifteen minutes", () => {
    const state = fail(LOGIN_DEVICE_FAILURE_LIMIT);
    const decision = loginLimitDecision(state, "device_key_123456", now + 10);

    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterMs).toBeGreaterThan(LOGIN_LOCKOUT_MS - 20);
  });

  it("unlocks after the lockout and failure window expire", () => {
    const state = fail(LOGIN_DEVICE_FAILURE_LIMIT);
    const decision = loginLimitDecision(
      state,
      "device_key_123456",
      now + Math.max(LOGIN_LOCKOUT_MS, LOGIN_FAILURE_WINDOW_MS) + 10,
    );

    expect(decision).toEqual({ allowed: true, delayMs: 0, retryAfterMs: 0 });
  });

  it("does not let one device trivially lock a different device", () => {
    const state = fail(LOGIN_DEVICE_FAILURE_LIMIT, "attacker_device_1");

    expect(loginLimitDecision(state, "owner_device_123", now + 10).allowed).toBe(true);
    expect(loginLimitDecision(state, "attacker_device_1", now + 10).allowed).toBe(false);
  });

  it("slows rotating-device attacks without locking a different device", () => {
    let state: LoginAttemptState | null = null;
    for (let index = 0; index < 20; index += 1) {
      state = recordLoginFailure(state, `rotating_device_${index}`, now + index);
    }

    const decision = loginLimitDecision(state, "owner_device_123", now + 100);
    expect(decision.allowed).toBe(true);
    expect(decision.delayMs).toBeGreaterThan(0);
  });

  it("uses one generic login error for invalid credentials and throttling", () => {
    expect(GENERIC_LOGIN_ERROR).toBe(
      "Sign in failed. Check your email and password, or wait before trying again.",
    );
    expect(GENERIC_LOGIN_ERROR.toLowerCase()).not.toContain("account");
    expect(GENERIC_LOGIN_ERROR.toLowerCase()).not.toContain("locked");
  });
});
