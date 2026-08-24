import { describe, expect, it } from "vitest";
import {
  NativeTimeoutError,
  isNativeTimeoutError,
  withTimeout,
  withTimeoutFallback,
} from "@novend/hardware";

describe("withTimeout", () => {
  it("resolves when the operation finishes in time", async () => {
    await expect(withTimeout(Promise.resolve(42), 100)).resolves.toBe(42);
  });

  it("rejects with NativeTimeoutError when the budget elapses", async () => {
    await expect(
      withTimeout(new Promise(() => undefined), 20),
    ).rejects.toBeInstanceOf(NativeTimeoutError);
  });

  it("withTimeoutFallback returns the fallback on timeout", async () => {
    await expect(
      withTimeoutFallback(() => new Promise(() => undefined), 20, "fallback"),
    ).resolves.toBe("fallback");
  });

  it("detects timeout errors", () => {
    expect(isNativeTimeoutError(new NativeTimeoutError())).toBe(true);
    expect(isNativeTimeoutError(new Error("timeout"))).toBe(true);
    expect(isNativeTimeoutError(new Error("other"))).toBe(false);
  });
});
