import { describe, expect, it } from "vitest";
import {
  clampInt,
  digitsOnly,
  parsePositiveInt,
  parseUnsignedInt,
  signedStockDelta,
} from "@/lib/quantity";

describe("quantity keypad helpers", () => {
  it("accepts whole digits and rejects signed or decimal text", () => {
    expect(parseUnsignedInt("0")).toBe(0);
    expect(parseUnsignedInt("48")).toBe(48);
    expect(parseUnsignedInt("")).toBeNull();
    expect(parseUnsignedInt("-12")).toBeNull();
    expect(parseUnsignedInt("12.5")).toBeNull();
    expect(parsePositiveInt("0")).toBeNull();
    expect(parsePositiveInt("1")).toBe(1);
  });

  it("strips non-digits so a keypad cannot inject a minus", () => {
    expect(digitsOnly("-12")).toBe("12");
    expect(digitsOnly("1e3")).toBe("13");
  });

  it("applies add/remove without requiring a typed minus", () => {
    expect(signedStockDelta("add", "50")).toBe(50);
    expect(signedStockDelta("remove", "12")).toBe(-12);
    expect(signedStockDelta("remove", "0")).toBeNull();
    expect(clampInt(80, 0, 40)).toBe(40);
  });
});
