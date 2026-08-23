import { afterEach, describe, expect, it, vi } from "vitest";
import { getPlatform, isCapacitor, resetHardwareAdapters } from "@novend/hardware";

describe("platform detection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetHardwareAdapters();
  });

  it("detects Capacitor Android via androidBridge", () => {
    vi.stubGlobal("window", {
      androidBridge: {},
      navigator: { userAgent: "Android WebView" },
    });
    expect(getPlatform()).toBe("android");
    expect(isCapacitor()).toBe(true);
  });

  it("detects Capacitor iOS via webkit bridge", () => {
    vi.stubGlobal("window", {
      webkit: { messageHandlers: { bridge: {} } },
      navigator: { userAgent: "iPhone" },
    });
    expect(getPlatform()).toBe("ios");
    expect(isCapacitor()).toBe(true);
  });

  it("prefers Electron over Capacitor bridge", () => {
    vi.stubGlobal("window", {
      novendDesktop: {},
      androidBridge: {},
    });
    expect(getPlatform()).toBe("electron");
    expect(isCapacitor()).toBe(false);
  });

  it("returns web in a normal browser", () => {
    vi.stubGlobal("window", {
      navigator: { userAgent: "Mozilla/5.0 Chrome" },
    });
    expect(getPlatform()).toBe("web");
    expect(isCapacitor()).toBe(false);
  });
});
