import { describe, expect, it } from "vitest";
import {
  assertTrustedIpcSender,
  createTrustedOriginPolicy,
  isAllowedExternalUrl,
  isAllowedMediaPermission,
  isTrustedIpcSender,
  isTrustedRendererUrl,
  normalizeConfiguredAppOrigin,
  validateAuthShellEntry,
} from "../apps/desktop/src/trusted-origin";

describe("desktop trusted-origin policy", () => {
  const appUrl = "https://novend.example.com/dashboard";
  const offlineBootUrl = "file:///C:/Program%20Files/Novend/resources/offline-boot.html";
  const policy = createTrustedOriginPolicy(appUrl, [offlineBootUrl]);

  it("normalizes the configured URL to its exact origin", () => {
    expect(normalizeConfiguredAppOrigin(" https://Novend.Example.com:443/path/?x=1 ")).toBe(
      "https://novend.example.com",
    );
    expect(normalizeConfiguredAppOrigin("http://127.0.0.1:3000/dashboard")).toBe(
      "http://127.0.0.1:3000",
    );
    expect(() => normalizeConfiguredAppOrigin("javascript:alert(1)")).toThrow();
    expect(() => normalizeConfiguredAppOrigin("https://user:secret@novend.example.com")).toThrow();
  });

  it("allows only the exact app origin and explicitly trusted local files", () => {
    expect(isTrustedRendererUrl(policy, "https://novend.example.com/login")).toBe(true);
    expect(isTrustedRendererUrl(policy, "https://novend.example.com:444/login")).toBe(false);
    expect(isTrustedRendererUrl(policy, "https://novend.example.com.evil.test")).toBe(false);
    expect(isTrustedRendererUrl(policy, "https://example.com")).toBe(false);
    expect(isTrustedRendererUrl(policy, "//example.com")).toBe(false);
    expect(isTrustedRendererUrl(policy, "javascript:alert(1)")).toBe(false);
    expect(isTrustedRendererUrl(policy, `${offlineBootUrl}?entry=%2Flogin`)).toBe(true);
    expect(isTrustedRendererUrl(policy, "file:///C:/Windows/System32/calc.exe")).toBe(false);
  });

  it("uses the invoking frame URL for IPC and rejects untrusted senders", () => {
    const trustedEvent = {
      senderFrame: { url: "https://novend.example.com/dashboard" },
      sender: { getURL: () => "https://example.com" },
    };
    const untrustedFrame = {
      senderFrame: { url: "https://example.com" },
      sender: { getURL: () => "https://novend.example.com/dashboard" },
    };
    const fallbackEvent = {
      senderFrame: null,
      sender: { getURL: () => `${offlineBootUrl}?appUrl=https%3A%2F%2Fnovend.example.com` },
    };

    expect(isTrustedIpcSender(policy, trustedEvent)).toBe(true);
    expect(isTrustedIpcSender(policy, fallbackEvent)).toBe(true);
    expect(isTrustedIpcSender(policy, untrustedFrame)).toBe(false);
    expect(() => assertTrustedIpcSender(policy, untrustedFrame)).toThrow(
      "Unauthorized IPC sender.",
    );
  });

  it("allows media permission only for the configured app origin", () => {
    expect(isAllowedMediaPermission(policy, "media", "https://novend.example.com/dashboard")).toBe(
      true,
    );
    expect(isAllowedMediaPermission(policy, "media", offlineBootUrl)).toBe(false);
    expect(isAllowedMediaPermission(policy, "media", "https://example.com")).toBe(false);
    expect(isAllowedMediaPermission(policy, "notifications", "https://novend.example.com")).toBe(
      false,
    );
  });
});

describe("desktop external link policy", () => {
  it("allows only absolute HTTPS and mailto targets", () => {
    expect(isAllowedExternalUrl("https://novend.example.com/help")).toBe(true);
    expect(isAllowedExternalUrl("mailto:support@novend.example.com")).toBe(true);
    expect(isAllowedExternalUrl("//example.com")).toBe(false);
    expect(isAllowedExternalUrl("http://example.com")).toBe(false);
    expect(isAllowedExternalUrl("file:///C:/secret.txt")).toBe(false);
    expect(isAllowedExternalUrl("data:text/html,hello")).toBe(false);
    expect(isAllowedExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedExternalUrl("novend://settings")).toBe(false);
  });
});

describe("desktop authentication shell routes", () => {
  it("accepts auth routes and post-login shell roots only", () => {
    expect(validateAuthShellEntry("/login")).toBe("/login");
    expect(validateAuthShellEntry("/login?signedOut=1")).toBe("/login?signedOut=1");
    expect(validateAuthShellEntry("/signup")).toBe("/signup");
    expect(validateAuthShellEntry("/forgot-password")).toBe("/forgot-password");
    expect(validateAuthShellEntry("/reset-password")).toBe("/reset-password");
    expect(validateAuthShellEntry("/dashboard")).toBe("/dashboard");
    expect(validateAuthShellEntry("/dashboard?fromLogin=1")).toBe("/dashboard?fromLogin=1");
    expect(validateAuthShellEntry("/platform?fromLogin=1")).toBe("/platform?fromLogin=1");
    expect(validateAuthShellEntry("/onboarding?fromLogin=1")).toBe("/onboarding?fromLogin=1");
    expect(validateAuthShellEntry("/dashboard?fromBoot=1")).toBeNull();
    expect(validateAuthShellEntry("/products")).toBeNull();
    expect(validateAuthShellEntry("/products?fromLogin=1")).toBeNull();
  });

  it("rejects external, encoded, malformed, and backslash routes", () => {
    expect(validateAuthShellEntry("//example.com/login")).toBeNull();
    expect(validateAuthShellEntry("/https:%2F%2Fexample.com")).toBeNull();
    expect(
      validateAuthShellEntry("/%2568%2574%2574%2570%2573%253A%252F%252Fexample.com"),
    ).toBeNull();
    expect(validateAuthShellEntry("/login\\..\\dashboard")).toBeNull();
    expect(validateAuthShellEntry("https://example.com/login")).toBeNull();
    expect(validateAuthShellEntry("/login?next=https%3A%2F%2Fexample.com")).toBeNull();
    expect(validateAuthShellEntry("/login#https://example.com")).toBeNull();
  });
});
