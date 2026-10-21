import { describe, expect, it } from "vitest";
import {
  formatReceiptLineTitle,
  formatReceiptProductName,
} from "@/features/receipts/line-title";

describe("receipt line title (multi-unit pack)", () => {
  it("appends the chosen sell unit so receipts match checkout", () => {
    expect(
      formatReceiptProductName({
        productName: "Peeva Water 1.5L",
        sellUnitLabel: "Carton",
      }),
    ).toBe("Peeva Water 1.5L (Carton)");
  });

  it("skips missing or legacy default labels", () => {
    expect(formatReceiptProductName({ productName: "Soap" })).toBe("Soap");
    expect(
      formatReceiptProductName({ productName: "Soap", sellUnitLabel: "default" }),
    ).toBe("Soap");
  });

  it("numbers lines for ESC/POS and on-screen receipts", () => {
    expect(
      formatReceiptLineTitle(
        { productName: "Rice", sellUnitLabel: "Pack" },
        2,
      ),
    ).toBe("2. Rice (Pack)");
  });
});
