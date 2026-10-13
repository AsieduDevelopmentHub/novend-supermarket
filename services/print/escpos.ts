import { RECEIPT_VENDOR_FOOTER } from "@/constants/app";
import type { ReceiptPayload } from "@/features/receipts/types";
import { receiptPaymentLines } from "@/features/receipts/payment-lines";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { sanitizeReceiptCopy } from "@/lib/receipt-print-mode";

/**
 * Minimal ESC/POS encoder for common 58/80mm thermal receipt printers.
 * Produces a Uint8Array suitable for raw TCP :9100 or a Windows RAW spooler.
 */

const ESC = 0x1b;
const GS = 0x1d;

function encodeText(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code <= 0xff) out.push(code);
    else out.push(0x3f);
  }
  return out;
}

function line(width: number, left: string, right = "") {
  const maxLeft = Math.max(0, width - right.length - 1);
  const clipped = left.length > maxLeft ? `${left.slice(0, Math.max(0, maxLeft - 1))}…` : left;
  if (!right) return clipped.padEnd(width).slice(0, width);
  const gap = Math.max(1, width - clipped.length - right.length);
  return `${clipped}${" ".repeat(gap)}${right}`.slice(0, width);
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

  write(ESC, 0x40, ESC, 0x74, 0x00);
  write(ESC, 0x61, 0x01);
  write(b.tradeName || "Receipt", "\n");
  const headerText = sanitizeReceiptCopy(t.headerText, "");
  if (headerText) write(headerText, "\n");
  if (b.branchName) write(b.branchName, "\n");
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

  for (const item of payload.lines) {
    write(line(cols, item.productName, formatCurrency(item.lineTotal)), "\n");
    const meta = [
      `${item.quantity} x ${formatCurrency(item.unitPrice)}`,
      item.discount > 0 ? `(-${formatCurrency(item.discount)})` : "",
      t.showSku && item.sku ? item.sku : "",
    ]
      .filter(Boolean)
      .join(" · ");
    if (meta) write(meta, "\n");
  }

  write(sep(cols), "\n");
  write(line(cols, "Subtotal", formatCurrency(payload.subtotal)), "\n");
  write(line(cols, "Discount", formatCurrency(payload.discount)), "\n");
  write(ESC, 0x45, 0x01);
  write(line(cols, "TOTAL", formatCurrency(payload.total)), "\n");
  write(ESC, 0x45, 0x00);
  if (t.showPaymentMethod && splitLines) {
    for (const split of splitLines) {
      write(line(cols, split.label, formatCurrency(split.amount)), "\n");
    }
  }
  write(sep(cols), "\n");
  write(ESC, 0x61, 0x01);
  if (t.footerText) write(t.footerText, "\n");
  if (t.thankYouLine) write(t.thankYouLine, "\n");
  write("\n", RECEIPT_VENDOR_FOOTER, "\n");
  write("\n\n");
  write(GS, 0x56, 0x01);
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

export function escPosToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
