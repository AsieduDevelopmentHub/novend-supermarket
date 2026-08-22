import { describe, expect, it } from "vitest";
import { postLoginPath } from "@/lib/auth/post-login-path";

describe("postLoginPath", () => {
  it("sends platform administrators to /platform", () => {
    expect(postLoginPath({ isPlatformAdmin: true, needsOnboarding: true })).toBe("/platform");
  });

  it("sends users who still need a business to /onboarding", () => {
    expect(postLoginPath({ needsOnboarding: true })).toBe("/onboarding");
    expect(postLoginPath({ needsProfile: true })).toBe("/onboarding");
  });

  it("sends tenant users to /dashboard", () => {
    expect(postLoginPath({ isPlatformAdmin: false, needsOnboarding: false })).toBe("/dashboard");
    expect(postLoginPath(null)).toBe("/dashboard");
  });
});
