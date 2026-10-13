import { describe, expect, it } from "vitest";
import {
  assertSerialListForQuantity,
  normalizeSerial,
} from "@/convex/shared/serialTracking";

describe("serial tracking", () => {
  it("normalizes serials", () => {
    expect(normalizeSerial("  ab-12 ")).toBe("AB-12");
  });

  it("requires one serial per base unit", () => {
    expect(assertSerialListForQuantity(["a", "b"], 2, "Phone")).toEqual(["A", "B"]);
    expect(() => assertSerialListForQuantity(["a"], 2, "Phone")).toThrow(/Enter 2 serial/);
    expect(() => assertSerialListForQuantity(["a", "a"], 2, "Phone")).toThrow(/Duplicate/);
    expect(() => assertSerialListForQuantity(["a"], 1.5, "Phone")).toThrow(/whole-unit/);
  });
});
