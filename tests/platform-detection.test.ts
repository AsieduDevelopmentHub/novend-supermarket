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

  it("detects Capacitor Android via System WebView user agent (wv)", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36 wv",
    });
    vi.stubGlobal("window", {});
    expect(getPlatform()).toBe("android");
    expect(isCapacitor()).toBe(true);
  });

  it("detects Capacitor via NovendCapacitor user-agent marker", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/112.0.0.0 Mobile Safari/537.36 NovendCapacitor/1.0",
    });
    vi.stubGlobal("window", {});
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
