import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RECEIPT_VENDOR_FOOTER } from "@/constants/app";
import { SAMPLE_RECEIPT_PAYLOAD } from "@/features/receipts/types";
import { buildEscPosReceipt } from "@/services/print/escpos";
import { buildReceiptPrintHtml } from "@/services/printing";
import { buildReceiptShareText } from "@/services/receipts/share";

describe("receipt vendor footer", () => {
  it("fits one 58mm thermal line in plain ASCII", () => {
    expect(RECEIPT_VENDOR_FOOTER).toBe("Powered by Novend POS");
    expect(RECEIPT_VENDOR_FOOTER.length).toBeLessThanOrEqual(32);
    expect(RECEIPT_VENDOR_FOOTER).toMatch(/^[\x20-\x7e]+$/);
  });

  it("is printed on ESC/POS, browser print and shared receipts", () => {
    for (const width of [58, 80] as const) {
      const text = new TextDecoder("latin1").decode(
        buildEscPosReceipt(SAMPLE_RECEIPT_PAYLOAD, width),
      );
      expect(text).toContain(RECEIPT_VENDOR_FOOTER);
    }
    expect(buildReceiptPrintHtml(SAMPLE_RECEIPT_PAYLOAD)).toContain(RECEIPT_VENDOR_FOOTER);
    expect(buildReceiptShareText(SAMPLE_RECEIPT_PAYLOAD)).toContain(RECEIPT_VENDOR_FOOTER);
  });

  it("is shown on the on-screen receipt regardless of template settings", () => {
    const source = readFileSync(
      resolve(process.cwd(), "features/receipts/components/receipt-document.tsx"),
      "utf8",
    );
    expect(source).toContain("{RECEIPT_VENDOR_FOOTER}</p>");
  });
});
