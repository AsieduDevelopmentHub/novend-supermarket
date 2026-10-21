import { RECEIPT_VENDOR_FOOTER } from "@/constants/app";
import type { ReceiptPayload } from "@/features/receipts/types";
import { formatReceiptLineTitle } from "@/features/receipts/line-title";
import { receiptPaymentLines } from "@/features/receipts/payment-lines";
import { formatCurrencyEscPos } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { sanitizeReceiptCopy } from "@/lib/receipt-print-mode";

/**
 * Minimal ESC/POS encoder for common 58/80mm thermal receipt printers.
 * Produces a Uint8Array suitable for raw TCP :9100 or a Windows RAW spooler.
 */

const ESC = 0x1b;
const GS = 0x1d;

/** Map common Unicode punctuation to ASCII so columns stay aligned on CP437 printers. */
function toEscPosAscii(text: string): string {
  return text
    .replaceAll("₵", "")
    .replaceAll("¢", "")
    .replaceAll("−", "-")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("…", "...")
    .replaceAll("·", "-")
    .replaceAll("×", "x")
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("\u00a0", " ");
}

function encodeText(text: string): number[] {
  const out: number[] = [];
  for (const ch of toEscPosAscii(text)) {
    const code = ch.charCodeAt(0);
    if (code <= 0xff) out.push(code);
    else out.push(0x3f);
  }
  return out;
}

function line(width: number, left: string, right = "") {
  const maxLeft = Math.max(0, width - right.length - 1);
  const clipped =
    left.length > maxLeft ? `${left.slice(0, Math.max(0, maxLeft - 3))}...` : left;
  if (!right) return clipped.padEnd(width).slice(0, width);
  const gap = Math.max(1, width - clipped.length - right.length);
  return `${clipped}${" ".repeat(gap)}${right}`.slice(0, width);
}

/** Wrap long names across 58mm lines without eating the amount column. */
function wrapLeft(text: string, width: number): string[] {
  const value = text.trim();
  if (!value) return [];
  if (value.length <= width) return [value];
  const rows: string[] = [];
  let rest = value;
  while (rest.length > width) {
    let cut = rest.lastIndexOf(" ", width);
    if (cut < Math.floor(width / 2)) cut = width;
    rows.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) rows.push(rest);
  return rows;
}

function sep(width: number, char = "-") {
  return char.repeat(width);
}

/** Build ESC/POS bytes for a receipt payload. */
export function buildEscPosReceipt(payload: ReceiptPayload, paperWidthMm: 58 | 80): Uint8Array {
  const cols = paperWidthMm === 58 ? 32 : 48;
  const t = payload.template;
  const b = payload.business;
  const bytes: number[] = [];

  const write = (...parts: Array<number | number[] | string>) => {
    for (const part of parts) {
      if (typeof part === "string") bytes.push(...encodeText(part));
      else if (typeof part === "number") bytes.push(part);
      else bytes.push(...part);
    }
  };

  const tradeName = (b.tradeName || "Receipt").trim();
  const branchName = (b.branchName || "").trim();
  // Avoid "Millie's / Millie's" when branch was seeded with the store name.
  const showBranch = Boolean(branchName) && branchName.toLowerCase() !== tradeName.toLowerCase();

  /**
   * Cheap ESC/POS tills often ignore ESC E (emphasize) alone. Pair with
   * double-strike (ESC G) for weight — do not use GS ! size (2× wraps the
   * store name and stretches TOTAL on 58mm paper).
   */
  const setEmphasized = (on: boolean) => {
    write(ESC, 0x45, on ? 0x01 : 0x00); // emphasize
    write(ESC, 0x47, on ? 0x01 : 0x00); // double-strike
  };

  write(ESC, 0x40, ESC, 0x74, 0x00);
  write(ESC, 0x61, 0x01);
  setEmphasized(true);
  write(tradeName, "\n");
  setEmphasized(false);
  const headerText = sanitizeReceiptCopy(t.headerText, "");
  if (headerText) write(headerText, "\n");
  if (showBranch) write(branchName, "\n");
  if (b.address) write(b.address, "\n");
  if (b.phone) write(`Tel: ${b.phone}`, "\n");
  if (b.email) write(b.email, "\n");
  if (b.taxId) write(`TIN: ${b.taxId}`, "\n");

  write(ESC, 0x61, 0x00);
  write(sep(cols), "\n");
  write(`Invoice: ${payload.invoiceNumber}`, "\n");
  write(formatDateTime(payload.completedAt), "\n");
  if (t.showCashier && payload.cashierName) write(`Cashier: ${payload.cashierName}`, "\n");
  if (t.showCustomer) write(`Customer: ${payload.customerName}`, "\n");
  const splitLines = receiptPaymentLines(payload);
  if (t.showPaymentMethod) {
    write(
      splitLines ? "Payment: Split" : `Payment: ${payload.paymentMethod.replaceAll("_", " ")}`,
      "\n",
    );
  }
  write(sep(cols), "\n");

  const narrow = paperWidthMm === 58;
  payload.lines.forEach((item, index) => {
    const amount = formatCurrencyEscPos(item.lineTotal);
    const titled = formatReceiptLineTitle(item, index + 1);
    if (narrow) {
      // 58mm: name on its own line(s), qty + amount right-aligned on the next.
      for (const row of wrapLeft(titled, cols)) {
        write(row, "\n");
      }
      const qtyLeft = [
        `${item.quantity} x ${formatCurrencyEscPos(item.unitPrice)}`,
        item.discount > 0 ? `(-${formatCurrencyEscPos(item.discount)})` : "",
      ]
        .filter(Boolean)
        .join(" ");
      write(line(cols, qtyLeft, amount), "\n");
      if (t.showSku && item.sku) write(item.sku, "\n");
    } else {
      write(line(cols, titled, amount), "\n");
      const meta = [
        `${item.quantity} x ${formatCurrencyEscPos(item.unitPrice)}`,
        item.discount > 0 ? `(-${formatCurrencyEscPos(item.discount)})` : "",
        t.showSku && item.sku ? item.sku : "",
      ]
        .filter(Boolean)
        .join(" - ");
      if (meta) write(meta, "\n");
    }
    // Blank line between products so line 1 / 2 do not look stuck together.
    if (index < payload.lines.length - 1) write("\n");
  });

  write(sep(cols), "\n");
  write(line(cols, "Subtotal", formatCurrencyEscPos(payload.subtotal)), "\n");
  if (payload.discount > 0) {
    write(line(cols, "Discount", formatCurrencyEscPos(payload.discount)), "\n");
  }
  if (typeof payload.taxNet === "number" && typeof payload.taxAmount === "number") {
    write(line(cols, "Net", formatCurrencyEscPos(payload.taxNet)), "\n");
    const taxLabel = [
      payload.taxLabel ?? "VAT",
      typeof payload.taxRatePercent === "number" ? `(${payload.taxRatePercent}%)` : null,
    ]
      .filter(Boolean)
      .join(" ");
    write(line(cols, taxLabel, formatCurrencyEscPos(payload.taxAmount)), "\n");
  }
  setEmphasized(true);
  write(line(cols, "TOTAL", formatCurrencyEscPos(payload.total)), "\n");
  setEmphasized(false);
  if (t.showPaymentMethod && splitLines) {
    for (const split of splitLines) {
      write(line(cols, split.label, formatCurrencyEscPos(split.amount)), "\n");
    }
  }
  if (typeof payload.amountPaid === "number") {
    write(line(cols, "Paid", formatCurrencyEscPos(payload.amountPaid)), "\n");
    write(line(cols, "Change", formatCurrencyEscPos(payload.changeGiven ?? 0)), "\n");
  }
  write(sep(cols), "\n");
  write(ESC, 0x61, 0x01);
  if (t.footerText) write(t.footerText, "\n");
  if (t.thankYouLine) write(t.thankYouLine, "\n");
  write("\n", RECEIPT_VENDOR_FOOTER, "\n");
  write("\n\n");
  // Full cut (not partial) so the ticket releases instead of pausing in the cutter.
  write(GS, 0x56, 0x00);
  write("\n");

  return new Uint8Array(bytes);
}

/** ESC/POS Code128 barcode (GS k). Keep payload ASCII for broad printer support. */
export function buildEscPosBarcode(data: string): Uint8Array {
  const payload = data.slice(0, 64);
  const bytes: number[] = [
    0x1d,
    0x68,
    0x50, // height
    0x1d,
    0x77,
    0x02, // width module
    0x1d,
    0x48,
    0x02, // HRI below
    0x1d,
    0x6b,
    0x49, // Code128
    payload.length,
    ...encodeText(payload),
    0x0a,
  ];
  return new Uint8Array(bytes);
}

/**
 * ESC/POS QR code (model 2). Many ESC/POS printers accept this sequence;
 * unsupported models ignore it safely when followed by cut.
 */
export function buildEscPosQr(data: string): Uint8Array {
  const payload = encodeText(data.slice(0, 256));
  const storeLen = payload.length + 3;
  const pL = storeLen & 0xff;
  const pH = (storeLen >> 8) & 0xff;
  const bytes: number[] = [
    0x1d,
    0x28,
    0x6b,
    0x04,
    0x00,
    0x31,
    0x41,
    0x32,
    0x00, // model 2
    0x1d,
    0x28,
    0x6b,
    0x03,
    0x00,
    0x31,
    0x43,
    0x06, // size
    0x1d,
    0x28,
    0x6b,
    0x03,
    0x00,
    0x31,
    0x45,
    0x31, // error correction M
    0x1d,
    0x28,
    0x6b,
    pL,
    pH,
    0x31,
    0x50,
    0x30,
    ...payload,
    0x1d,
    0x28,
    0x6b,
    0x03,
    0x00,
    0x31,
    0x51,
    0x30, // print
    0x0a,
  ];
  return new Uint8Array(bytes);
}

/** ESC/POS cash drawer kick (pin 2 — common default on thermal printers). */
export function cashDrawerPulseBytes(): Uint8Array {
  return new Uint8Array([ESC, 0x70, 0x00, 0x19, 0xfa]);
}

/** Append a drawer pulse after receipt bytes (Cap Bluetooth / when the bridge ignores the flag). */
export function appendCashDrawerPulse(bytes: Uint8Array): Uint8Array {
  const pulse = cashDrawerPulseBytes();
  const out = new Uint8Array(bytes.length + pulse.length);
  out.set(bytes, 0);
  out.set(pulse, bytes.length);
  return out;
}

export function escPosToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
