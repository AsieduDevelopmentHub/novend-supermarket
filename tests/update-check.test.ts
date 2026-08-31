import { describe, expect, it } from "vitest";
import { describeUpdateCheck } from "@/lib/native/update-check";

describe("describeUpdateCheck", () => {
  it("does not alarm when the device is offline", () => {
    expect(
      describeUpdateCheck({
        checking: false,
        online: false,
        update: {
          available: false,
          status: "unreachable",
          notes: "Could not reach the update server.",
        },
      }),
    ).toBe("Offline — check when connected");
  });

  it("uses the offline status from the native adapter", () => {
    expect(
      describeUpdateCheck({
        checking: false,
        online: true,
        update: { available: false, status: "offline" },
      }),
    ).toBe("Offline — check when connected");
  });

  it("distinguishes unreachable from latest", () => {
    expect(
      describeUpdateCheck({
        checking: false,
        online: true,
        update: { available: false, status: "unreachable" },
      }),
    ).toBe("Could not reach the update server");
    expect(
      describeUpdateCheck({
        checking: false,
        online: true,
        update: { available: false, status: "latest" },
      }),
    ).toBe("Latest verified");
  });

  it("does not alarm on Android Studio / LAN development origins", () => {
    expect(
      describeUpdateCheck({
        checking: false,
        online: true,
        update: { available: false, status: "dev" },
      }),
    ).toBe("Not checked in development");
  });
});
