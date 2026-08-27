import { describe, expect, it } from "vitest";
import { friendlyHardwareMessage, permissionDeniedMessage } from "@novend/hardware";

describe("friendlyHardwareMessage", () => {
  it("does not treat a missing plugin as camera permission denied", () => {
    expect(
      friendlyHardwareMessage("Camera is not implemented on web", "Could not capture a photo."),
    ).toBe("Could not capture a photo.");
    expect(
      friendlyHardwareMessage("Share plugin is not available", "Unable to share right now."),
    ).toBe("Unable to share right now.");
  });

  it("maps real permission denials to the matching copy", () => {
    expect(friendlyHardwareMessage("User denied camera permission", "fallback", "camera")).toBe(
      permissionDeniedMessage("camera"),
    );
    expect(
      friendlyHardwareMessage("Notification permission denied", "fallback", "notifications"),
    ).toBe(permissionDeniedMessage("notifications"));
  });

  it("does not treat generic access errors as a turned-off camera", () => {
    expect(friendlyHardwareMessage("Could not access the file", "Unable to save the receipt.")).toBe(
      "Could not access the file",
    );
  });
});
