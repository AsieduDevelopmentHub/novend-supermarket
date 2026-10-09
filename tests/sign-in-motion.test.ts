import { describe, expect, it } from "vitest";
import {
  resolveSplashMotion,
  SHORT_SPLASH_MS,
  SIGN_IN_SPLASH_LAND_MS,
  signInCoverDelays,
} from "../lib/auth/sign-in-motion";

describe("sign-in cover motion", () => {
  it("seeks the fall and holds the float until the logo has landed", () => {
    expect(signInCoverDelays(0)).toEqual({ fallDelayMs: 0, holdDelayMs: SIGN_IN_SPLASH_LAND_MS });
    expect(signInCoverDelays(1_000)).toEqual({
      fallDelayMs: -1_000,
      holdDelayMs: SIGN_IN_SPLASH_LAND_MS - 1_000,
    });
    expect(signInCoverDelays(SIGN_IN_SPLASH_LAND_MS + 800)).toEqual({
      fallDelayMs: -(SIGN_IN_SPLASH_LAND_MS + 800),
      holdDelayMs: -800,
    });
  });

  it("continues one fall across later splash mounts", () => {
    const started = 1_000;
    const first = resolveSplashMotion({
      settled: false,
      linger: false,
      elapsedMs: 0,
      now: started,
      signInStartedAt: null,
      bootStartedAt: null,
    });
    expect(first.motion).toEqual({ linger: false, settled: false, elapsedMs: 0 });
    expect(first.bootStartedAt).toBe(started);

    const mid = resolveSplashMotion({
      settled: false,
      linger: false,
      elapsedMs: 0,
      now: started + 400,
      signInStartedAt: null,
      bootStartedAt: first.bootStartedAt,
    });
    expect(mid.motion).toEqual({ linger: false, settled: false, elapsedMs: 400 });

    const landed = resolveSplashMotion({
      settled: false,
      linger: false,
      elapsedMs: 0,
      now: started + SHORT_SPLASH_MS,
      signInStartedAt: null,
      bootStartedAt: first.bootStartedAt,
    });
    expect(landed.motion.settled).toBe(true);
  });

  it("keeps the sign-in fall landed instead of replaying it on the shell", () => {
    const started = 5_000;
    const shell = resolveSplashMotion({
      settled: false,
      linger: false,
      elapsedMs: 0,
      now: started + SIGN_IN_SPLASH_LAND_MS,
      signInStartedAt: started,
      bootStartedAt: null,
    });
    expect(shell.motion.settled).toBe(true);
    expect(shell.motion.linger).toBe(false);

    const during = resolveSplashMotion({
      settled: false,
      linger: false,
      elapsedMs: 0,
      now: started + 1_000,
      signInStartedAt: started,
      bootStartedAt: null,
    });
    expect(during.motion).toEqual({ linger: true, settled: false, elapsedMs: 1_000 });
  });
});
