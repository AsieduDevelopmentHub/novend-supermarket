export type ReceiptPrintMode = "automatic" | "manual" | "never";

export function resolveReceiptPrintMode(prefs?: {
  receiptPrintMode?: ReceiptPrintMode;
  autoPrintReceipt?: boolean;
} | null): ReceiptPrintMode {
  if (
    prefs?.receiptPrintMode === "automatic" ||
    prefs?.receiptPrintMode === "manual" ||
    prefs?.receiptPrintMode === "never"
  ) {
    return prefs.receiptPrintMode;
  }
  return prefs?.autoPrintReceipt ? "automatic" : "manual";
}
