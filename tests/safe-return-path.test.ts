import { describe, expect, it } from "vitest";
import {
  loginPathWithNext,
  resolvePostAuthPath,
  safeInternalPath,
} from "@/lib/auth/safe-return-path";

describe("safeInternalPath", () => {
  it("accepts app and platform paths with search", () => {
    expect(safeInternalPath("/products/abc123")).toBe("/products/abc123");
    expect(safeInternalPath("/settings?section=billing")).toBe("/settings?section=billing");
    expect(safeInternalPath("/platform/organizations")).toBe("/platform/organizations");
  });

  it("rejects external, protocol-relative, and auth pages", () => {
    expect(safeInternalPath("https://evil.example/x")).toBeNull();
    expect(safeInternalPath("//evil.example/x")).toBeNull();
    expect(safeInternalPath("/login")).toBeNull();
    expect(safeInternalPath("/signup")).toBeNull();
    expect(safeInternalPath("/")).toBeNull();
    expect(safeInternalPath("/docs")).toBeNull();
  });
});

describe("resolvePostAuthPath", () => {
  it("honors a safe next path for tenant users", () => {
    expect(
      resolvePostAuthPath({ isPlatformAdmin: false, needsOnboarding: false }, "/orders/xyz"),
    ).toBe("/orders/xyz");
  });

  it("ignores unsafe next and falls back to the default", () => {
    expect(resolvePostAuthPath({ isPlatformAdmin: false, needsOnboarding: false }, "/login")).toBe(
      "/dashboard",
    );
  });

  it("keeps onboarding when the user still needs a business", () => {
    expect(resolvePostAuthPath({ needsOnboarding: true }, "/sales")).toBe("/onboarding");
  });

  it("allows platform deep links for platform admins", () => {
    expect(resolvePostAuthPath({ isPlatformAdmin: true }, "/platform/releases")).toBe(
      "/platform/releases",
    );
    expect(resolvePostAuthPath({ isPlatformAdmin: true }, "/sales")).toBe("/platform");
  });

  it("rejects platform next for tenant users", () => {
    expect(
      resolvePostAuthPath({ isPlatformAdmin: false, needsOnboarding: false }, "/platform"),
    ).toBe("/dashboard");
    expect(
      resolvePostAuthPath(
        { isPlatformAdmin: false, needsOnboarding: false },
        "/platform/organizations",
      ),
    ).toBe("/dashboard");
  });
});

describe("loginPathWithNext", () => {
  it("encodes a safe return path", () => {
    expect(loginPathWithNext("/products/1", "")).toBe(
      `/login?next=${encodeURIComponent("/products/1")}`,
    );
  });

  it("omits next when the path is not restorable", () => {
    expect(loginPathWithNext("/login", "")).toBe("/login");
  });

  it("strips fromBoot from next and keeps it on login", () => {
    expect(loginPathWithNext("/dashboard", "?fromBoot=1")).toBe(
      `/login?next=${encodeURIComponent("/dashboard")}&fromBoot=1`,
    );
  });
});
