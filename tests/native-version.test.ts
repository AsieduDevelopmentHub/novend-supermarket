import { describe, expect, it } from "vitest";
import { compareAppVersions, normalizeAppVersion } from "@novend/hardware";

describe("native app version comparison", () => {
  it("normalizes release prefixes and rejects untrusted values", () => {
    expect(normalizeAppVersion("v0.3.5")).toBe("0.3.5");
    expect(normalizeAppVersion(" 0.3.5+9 ")).toBe("0.3.5+9");
    expect(normalizeAppVersion("latest")).toBeNull();
    expect(normalizeAppVersion("https://example.com")).toBeNull();
  });

  it("compares numeric release components without trusting lexical order", () => {
    expect(compareAppVersions("0.3.10", "0.3.9")).toBeGreaterThan(0);
    expect(compareAppVersions("v0.3.5", "0.3.5")).toBe(0);
    expect(compareAppVersions("0.3.4", "0.3.5")).toBeLessThan(0);
    expect(compareAppVersions("bad", "0.3.5")).toBe(0);
  });
});
