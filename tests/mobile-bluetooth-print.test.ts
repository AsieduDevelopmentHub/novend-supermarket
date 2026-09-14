import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveMobilePaperWidthMm } from "@/services/print/terminal-config";
import { buildEscPosReceipt, escPosToBase64 } from "@/services/print/escpos";
import { SAMPLE_RECEIPT_PAYLOAD } from "@/features/receipts/types";
import { bluetoothPrintFailedMessage } from "@novend/hardware";

describe("mobile paper width", () => {
  it("prefers saved Hardware width over the receipt template", () => {
    expect(
      resolveMobilePaperWidthMm({
        savedPaperWidthMm: 58,
        templatePaperWidthMm: 80,
      }),
    ).toBe(58);
  });

  it("falls back to template then 80mm", () => {
    expect(
      resolveMobilePaperWidthMm({
        savedPaperWidthMm: null,
        templatePaperWidthMm: 58,
      }),
    ).toBe(58);
    expect(resolveMobilePaperWidthMm({})).toBe(80);
  });
});

describe("ESC/POS receipt width", () => {
  it("builds different layouts for 58mm and 80mm", () => {
    const narrow = buildEscPosReceipt(
      {
        ...SAMPLE_RECEIPT_PAYLOAD,
        template: { ...SAMPLE_RECEIPT_PAYLOAD.template, paperWidthMm: 58 },
      },
      58,
    );
    const wide = buildEscPosReceipt(
      {
        ...SAMPLE_RECEIPT_PAYLOAD,
        template: { ...SAMPLE_RECEIPT_PAYLOAD.template, paperWidthMm: 80 },
      },
      80,
    );
    expect(narrow.byteLength).toBeGreaterThan(0);
    expect(wide.byteLength).toBeGreaterThan(0);
    expect(escPosToBase64(narrow)).not.toBe(escPosToBase64(wide));
  });
});

describe("bluetooth print UX contracts", () => {
  it("maps structured failure codes to cashier copy", () => {
    expect(bluetoothPrintFailedMessage("not_paired")).toMatch(/Hardware/i);
    expect(bluetoothPrintFailedMessage("bluetooth_off")).toMatch(/Turn on Bluetooth/i);
    expect(bluetoothPrintFailedMessage("permission")).toMatch(/Nearby devices/i);
  });

  it("Cap sale print uses Hardware printer and mobile paper width", () => {
    const printing = readFileSync(resolve(process.cwd(), "services/printing.ts"), "utf8");
    expect(printing).toContain("resolveMobilePaperWidthMm");
    expect(printing).toContain("Hardware.printer.printReceipt");
    expect(printing).toContain("failureCode");
  });

  it("registers the Classic SPP plugin on Android", () => {
    const main = readFileSync(
      resolve(
        process.cwd(),
        "apps/mobile/android/app/src/main/java/com/novend/pos/MainActivity.java",
      ),
      "utf8",
    );
    expect(main).toContain("NovendBluetoothClassicPlugin");
  });
});
