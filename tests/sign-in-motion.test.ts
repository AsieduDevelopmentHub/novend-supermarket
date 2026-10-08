import { describe, expect, it } from "vitest";
import { SIGN_IN_SPLASH_LAND_MS, signInCoverDelays } from "../lib/auth/sign-in-motion";

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
});
