import { describe, expect, it } from "vitest";
import { postLoginPath } from "@/lib/auth/post-login-path";

describe("postLoginPath", () => {
  it("sends platform administrators to the dashboard", () => {
    expect(postLoginPath({ isPlatformAdmin: true, needsOnboarding: true })).toBe("/onboarding");
    expect(postLoginPath({ isPlatformAdmin: true })).toBe("/dashboard");
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
