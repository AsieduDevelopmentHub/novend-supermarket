import { describe, expect, it } from "vitest";
import {
  buildReference,
  fromSubunits,
  timingSafeEqual,
  toSubunits,
} from "@/convex/shared/paystack";

describe("Paystack money conversion", () => {
  it("converts cedis to pesewas without floating-point drift", () => {
    expect(toSubunits(149)).toBe(14900);
    expect(toSubunits(12.5)).toBe(1250);
    expect(fromSubunits(29900)).toBe(299);
  });

  it("round-trips the catalog prices", () => {
    for (const amount of [149, 299, 599, 1490, 2990, 4999]) {
      expect(fromSubunits(toSubunits(amount))).toBe(amount);
    }
  });
});

describe("webhook signature comparison", () => {
  it("accepts identical hex digests", () => {
    expect(timingSafeEqual("abc123", "abc123")).toBe(true);
  });

  it("rejects a different digest of the same length", () => {
    expect(timingSafeEqual("abc123", "abc124")).toBe(false);
  });

  it("rejects a different length without throwing", () => {
    expect(timingSafeEqual("ab", "abcd")).toBe(false);
  });
});

describe("checkout references", () => {
  it("builds a unique Novend-owned reference", () => {
    const first = buildReference("NVD");
    const second = buildReference("NVD");
    expect(first.startsWith("NVD_")).toBe(true);
    expect(first).not.toBe(second);
  });
});
