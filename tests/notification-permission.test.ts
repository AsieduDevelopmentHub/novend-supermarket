import { describe, expect, it } from "vitest";
import { mapNotificationDisplayState, resolveNotificationPermissionState } from "@novend/hardware";

describe("notification permission state", () => {
  it("never infers permanent denial from an app-side request count", () => {
    expect(mapNotificationDisplayState("denied", true)).toBe("denied");
    expect(mapNotificationDisplayState("denied", false)).toBe("denied");
  });

  it("uses native Android facts while tolerating upgraded preference stores", () => {
    expect(resolveNotificationPermissionState("denied", true, "permanently-denied")).toBe(
      "permanently-denied",
    );
    expect(resolveNotificationPermissionState("denied", true, "not-requested")).toBe("denied");
    expect(resolveNotificationPermissionState("prompt", false, null)).toBe("not-requested");
  });
});
