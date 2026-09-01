import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { compareAppVersions, normalizeAppVersion } from "@novend/hardware";
import { APP_VERSION } from "@/constants/app";
import packageJson from "../package.json";

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

describe("released version lock", () => {
  it("keeps About, package.json, and Android versionName on the same release", () => {
    expect(APP_VERSION).toBe(packageJson.version);
    const gradle = readFileSync("apps/mobile/android/app/build.gradle", "utf8");
    expect(gradle).toMatch(new RegExp(`versionName\\s+"${packageJson.version}"`));
    const mobile = JSON.parse(readFileSync("apps/mobile/package.json", "utf8")) as {
      version: string;
    };
    const desktop = JSON.parse(readFileSync("apps/desktop/package.json", "utf8")) as {
      version: string;
    };
    expect(mobile.version).toBe(packageJson.version);
    expect(desktop.version).toBe(packageJson.version);
  });
});
