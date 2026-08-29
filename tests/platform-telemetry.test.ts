import { describe, expect, it } from "vitest";
import {
  classifyReleaseAsset,
  clampTelemetryTimestamp,
  isTelemetryAction,
  isTelemetryFeature,
  utcDay,
} from "@/convex/shared/platformTelemetry";

describe("privacy-first platform telemetry", () => {
  it("accepts only allowlisted feature and action dimensions", () => {
    expect(isTelemetryFeature("sales")).toBe(true);
    expect(isTelemetryFeature("customer-email")).toBe(false);
    expect(isTelemetryAction("completed")).toBe(true);
    expect(isTelemetryAction("arbitrary-payload")).toBe(false);
  });

  it("clamps client timestamps to the ingestion window", () => {
    const now = Date.UTC(2026, 7, 29, 10);
    expect(clampTelemetryTimestamp(now - 3 * 24 * 60 * 60 * 1000, now)).toBe(
      now - 24 * 60 * 60 * 1000,
    );
    expect(clampTelemetryTimestamp(now + 60 * 60 * 1000, now)).toBe(now + 5 * 60 * 1000);
  });

  it("uses stable UTC day keys", () => {
    expect(utcDay(Date.UTC(2026, 7, 29, 23, 59))).toBe("2026-08-29");
  });

  it("classifies release assets without request metadata", () => {
    expect(classifyReleaseAsset("Novend Setup.exe")).toBe("windows-installer");
    expect(classifyReleaseAsset("Novend.AppImage")).toBe("linux-appimage");
    expect(classifyReleaseAsset("novend.apk")).toBe("android-apk");
    expect(classifyReleaseAsset("novend.aab")).toBe("android-aab");
    expect(classifyReleaseAsset("novend.ipa")).toBe("ios-ipa");
    expect(classifyReleaseAsset("latest.yml")).toBe("update-manifest");
  });
});
