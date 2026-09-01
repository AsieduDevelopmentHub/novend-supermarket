import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("does not treat a Capacitor PDF save as a successful print", () => {
    const source = readFileSync(resolve(process.cwd(), "services/printing.ts"), "utf8");
    expect(source).not.toContain("saveReceiptPdfOnDevice(payload)");
    expect(source).toContain("Hardware.printer.printReceipt");
    expect(source).toContain('connectionType: defaultPrinter.data?.connectionType ?? "bluetooth"');
  });
});
