import { describe, expect, it } from "vitest";
import { resolveFromBootTarget } from "@/lib/auth/last-route";

describe("resolveFromBootTarget", () => {
  it("does not remount when only stripping fromBoot on the current screen", () => {
    expect(
      resolveFromBootTarget({
        pathname: "/dashboard",
        search: "fromBoot=1",
        last: "/dashboard",
        role: "cashier",
      }),
    ).toEqual({ href: "/dashboard", remount: false });
  });

  it("remounts when restoring a different allowed last route", () => {
    expect(
      resolveFromBootTarget({
        pathname: "/dashboard",
        search: "fromBoot=1",
        last: "/sales",
        role: "cashier",
      }),
    ).toEqual({ href: "/sales", remount: true });
  });

  it("does not restore an admin path for a cashier", () => {
    expect(
      resolveFromBootTarget({
        pathname: "/dashboard",
        search: "fromBoot=1",
        last: "/users",
        role: "cashier",
      }),
    ).toEqual({ href: "/dashboard", remount: false });
  });

  it("sends platform-only sessions to /platform", () => {
    expect(
      resolveFromBootTarget({
        pathname: "/dashboard",
        search: "fromBoot=1",
        last: "/sales",
        isPlatformAdmin: true,
        platformOnly: true,
      }),
    ).toEqual({ href: "/platform", remount: true });
  });

  it("is a no-op without the boot marker", () => {
    expect(
      resolveFromBootTarget({
        pathname: "/dashboard",
        search: "",
        last: "/sales",
        role: "cashier",
      }),
    ).toBeNull();
  });
});
