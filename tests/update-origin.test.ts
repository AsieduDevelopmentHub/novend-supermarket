import { describe, expect, it } from "vitest";
import { shouldSkipMobileUpdateCheck } from "@novend/hardware";

describe("shouldSkipMobileUpdateCheck", () => {
  it("skips HTTP Android Studio live-reload", () => {
    expect(shouldSkipMobileUpdateCheck("http:", "10.0.2.2")).toBe(true);
    expect(shouldSkipMobileUpdateCheck("http:", "192.168.1.202")).toBe(true);
    expect(shouldSkipMobileUpdateCheck("http:", "localhost")).toBe(true);
  });

  it("runs on hosted HTTPS production origins", () => {
    expect(shouldSkipMobileUpdateCheck("https:", "novend-pos.vercel.app")).toBe(false);
  });

  it("skips localhost even over HTTPS", () => {
    expect(shouldSkipMobileUpdateCheck("https:", "localhost")).toBe(true);
    expect(shouldSkipMobileUpdateCheck("https:", "10.0.2.2")).toBe(true);
  });
});
