import { describe, expect, it } from "vitest";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  assertPasswordPolicy,
  passwordMeetsPolicy,
  passwordStrength,
} from "@/convex/shared/passwordPolicy";

describe("password policy", () => {
  it("rejects passwords shorter than the server minimum", () => {
    expect(passwordMeetsPolicy("Abcd1234")).toBe(false);
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(() => assertPasswordPolicy("short1A")).toThrow(PASSWORD_POLICY_MESSAGE);
  });

  it("accepts 12+ characters with upper, lower, and a number", () => {
    expect(passwordMeetsPolicy("ValidPass12x")).toBe(true);
    expect(() => assertPasswordPolicy("ValidPass12x")).not.toThrow();
  });

  it("exposes strength checks the UI can render before submit", () => {
    const weak = passwordStrength("abc");
    expect(weak.accepted).toBe(false);
    expect(weak.score).toBeLessThan(4);
    expect(weak.checks.some((check) => !check.ok)).toBe(true);

    const strong = passwordStrength("ValidPass12x");
    expect(strong.accepted).toBe(true);
    expect(strong.label).toBe("Strong");
  });
});
