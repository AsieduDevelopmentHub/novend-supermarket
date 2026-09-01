export type ReceiptPrintMode = "automatic" | "manual" | "never";

const DEFAULT_RECEIPT_TAGLINE = "Smart POS. Strong business.";

/** Drop accidental localhost/page URLs (browser autofill) from receipt copy. */
export function sanitizeReceiptCopy(value?: string | null, fallback = DEFAULT_RECEIPT_TAGLINE) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return fallback;
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(trimmed)) return fallback;
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") return fallback;
  } catch {
    /* slogan, not a URL */
  }
  return trimmed;
}

export function resolveReceiptPrintMode(
  prefs?: {
    receiptPrintMode?: ReceiptPrintMode;
    autoPrintReceipt?: boolean;
  } | null,
): ReceiptPrintMode {
  if (
    prefs?.receiptPrintMode === "automatic" ||
    prefs?.receiptPrintMode === "manual" ||
    prefs?.receiptPrintMode === "never"
  ) {
    return prefs.receiptPrintMode;
  }
  return prefs?.autoPrintReceipt ? "automatic" : "manual";
}

/** After checkout: skip, show the receipt sheet, or print once. Same on every platform. */
export function postSaleReceiptAction(mode: ReceiptPrintMode): "none" | "prompt" | "print" {
  if (mode === "never") return "none";
  if (mode === "automatic") return "print";
  return "prompt";
}
