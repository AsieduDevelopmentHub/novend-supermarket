import { describe, expect, it } from "vitest";
import { shouldForceClientShell } from "@/hooks/use-force-client-shell";

describe("shouldForceClientShell", () => {
  it("always uses client views on Capacitor", () => {
    expect(shouldForceClientShell({ capacitor: true, online: true })).toBe(true);
  });

  it("always uses client views on Electron", () => {
    expect(shouldForceClientShell({ capacitor: false, electron: true, online: true })).toBe(true);
  });

  it("uses client views when offline", () => {
    expect(shouldForceClientShell({ capacitor: false, online: false })).toBe(true);
  });

  it("does not remount web after a timer while online", () => {
    expect(shouldForceClientShell({ capacitor: false, electron: false, online: true })).toBe(
      false,
    );
  });
});
