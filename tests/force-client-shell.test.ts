import { describe, expect, it } from "vitest";
import { shouldForceClientShell } from "@/hooks/use-force-client-shell";
import { isAwaitingCloudReconnect } from "@/lib/auth/awaiting-cloud-reconnect";

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

  it("keeps client views while an offline shell awaits cloud reconnect", () => {
    expect(
      shouldForceClientShell({
        capacitor: false,
        electron: false,
        online: true,
        awaitingCloudReconnect: true,
      }),
    ).toBe(true);
  });
});

describe("isAwaitingCloudReconnect", () => {
  it("is false when authenticated", () => {
    expect(
      isAwaitingCloudReconnect({
        isAuthenticated: true,
        sessionHint: {
          userId: "u1",
          name: "A",
          role: "cashier",
          branchId: "b1",
          branchName: "Main",
          savedAt: Date.now(),
        },
      }),
    ).toBe(false);
  });

  it("is true with a session hint even without touching isLoading", () => {
    expect(
      isAwaitingCloudReconnect({
        isAuthenticated: false,
        sessionHint: {
          userId: "u1",
          name: "A",
          role: "cashier",
          branchId: "b1",
          branchName: "Main",
          savedAt: Date.now(),
        },
      }),
    ).toBe(true);
  });
});
