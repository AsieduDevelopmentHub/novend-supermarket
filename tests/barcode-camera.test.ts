import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  cameraErrorMessage,
  isCameraBarcodeSupported,
} from "@/services/hardware/barcode-camera";

describe("camera barcode support", () => {
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.stubGlobal("window", {
      isSecureContext: true,
      location: { hostname: "localhost" },
    });
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(),
        enumerateDevices: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("navigator", originalNavigator);
    vi.stubGlobal("window", originalWindow);
  });

  it("is supported when getUserMedia exists in a secure context", () => {
    expect(isCameraBarcodeSupported()).toBe(true);
  });

  it("is supported in Electron even without BarcodeDetector", () => {
    vi.stubGlobal("window", {
      isSecureContext: false,
      location: { hostname: "novend-pos.vercel.app" },
      novendDesktop: {},
    });
    expect(isCameraBarcodeSupported()).toBe(true);
  });

  it("is unsupported without getUserMedia", () => {
    vi.stubGlobal("navigator", { mediaDevices: {} });
    expect(isCameraBarcodeSupported()).toBe(false);
  });

  it("maps permission errors to friendly copy", () => {
    expect(cameraErrorMessage(new DOMException("denied", "NotAllowedError"))).toBe(
      "Allow camera access to continue.",
    );
    expect(cameraErrorMessage(new DOMException("missing", "NotFoundError"))).toBe(
      "No camera was found on this device.",
    );
    expect(cameraErrorMessage(new DOMException("busy", "NotReadableError"))).toBe(
      "Another application is using your camera.",
    );
  });
});
