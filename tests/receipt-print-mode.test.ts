import { describe, expect, it } from "vitest";
import { postSaleReceiptAction, resolveReceiptPrintMode } from "@/lib/receipt-print-mode";

describe("receipt print mode", () => {
  it("resolves stored modes and the autoPrintReceipt fallback", () => {
    expect(resolveReceiptPrintMode({ receiptPrintMode: "never" })).toBe("never");
    expect(resolveReceiptPrintMode({ receiptPrintMode: "automatic" })).toBe("automatic");
    expect(resolveReceiptPrintMode({ autoPrintReceipt: true })).toBe("automatic");
    expect(resolveReceiptPrintMode({ autoPrintReceipt: false })).toBe("manual");
  });

  it("maps after-sale action the same on every platform", () => {
    expect(postSaleReceiptAction("never")).toBe("none");
    expect(postSaleReceiptAction("manual")).toBe("prompt");
    expect(postSaleReceiptAction("automatic")).toBe("print");
  });
});
