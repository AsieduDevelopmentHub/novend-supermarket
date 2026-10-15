import { describe, expect, it } from "vitest";
import { appendCashDrawerPulse, cashDrawerPulseBytes } from "@/services/print/escpos";

describe("ESC/POS cash drawer pulse", () => {
  it("uses the common pin-2 kick sequence", () => {
    expect([...cashDrawerPulseBytes()]).toEqual([0x1b, 0x70, 0x00, 0x19, 0xfa]);
  });

  it("appends the pulse after receipt bytes without mutating the original", () => {
    const receipt = new Uint8Array([0x1b, 0x40, 0x48, 0x69]);
    const withDrawer = appendCashDrawerPulse(receipt);
    expect([...withDrawer]).toEqual([0x1b, 0x40, 0x48, 0x69, 0x1b, 0x70, 0x00, 0x19, 0xfa]);
    expect([...receipt]).toEqual([0x1b, 0x40, 0x48, 0x69]);
  });
});
