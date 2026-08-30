import type { ReceiptPayload } from "@/features/receipts/types";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { bytesToBlob, downloadBlob } from "@/lib/export/download";
import { normalizeReceiptPayload } from "@/services/printing";

/** Plain-text receipt for the native share sheet (WhatsApp, Messages, email, …). */
export function buildReceiptShareText(input: ReceiptPayload | Record<string, unknown>): string {
  const payload = normalizeReceiptPayload(input);
  const b = payload.business;
  const t = payload.template;
  const lines: string[] = [];

  lines.push(b.tradeName || "Receipt");
  if (b.branchName) lines.push(b.branchName);
  if (b.address) lines.push(b.address);
  if (b.phone) lines.push(`Tel: ${b.phone}`);
  lines.push("");
  lines.push(`Invoice: ${payload.invoiceNumber}`);
  lines.push(formatDateTime(payload.completedAt));
  if (t.showCashier && payload.cashierName) lines.push(`Cashier: ${payload.cashierName}`);
  if (t.showCustomer) lines.push(`Customer: ${payload.customerName}`);
  if (t.showPaymentMethod) {
    lines.push(`Payment: ${payload.paymentMethod.replace(/_/g, " ")}`);
  }
  lines.push("----------------");

  for (const line of payload.lines) {
    lines.push(`${line.productName}`);
    lines.push(
      `  ${line.quantity} x ${formatCurrency(line.unitPrice)} = ${formatCurrency(line.lineTotal)}`,
    );
  }

  lines.push("----------------");
  lines.push(`Subtotal: ${formatCurrency(payload.subtotal)}`);
  lines.push(`Discount: ${formatCurrency(payload.discount)}`);
  lines.push(`TOTAL: ${formatCurrency(payload.total)}`);
  if (t.thankYouLine) {
    lines.push("");
    lines.push(t.thankYouLine);
  }
  return lines.join("\n");
}

function receiptPdfFile(bytes: Uint8Array, fileName: string): File {
  const blob = bytesToBlob(bytes, "application/pdf");
  try {
    return new File([blob], fileName, { type: "application/pdf", lastModified: Date.now() });
  } catch {
    Object.defineProperty(blob, "name", { value: fileName, configurable: true });
    return blob as File;
  }
}

/**
 * PDF handoff. Share uses the Web Share API when the sheet can take a file.
 * Save / share-fallback go through `downloadBlob`, which writes Downloads on
 * Capacitor via the native JavascriptInterface (not the hung plugin bridge).
 */
async function offerReceiptPdf(
  bytes: Uint8Array,
  fileName: string,
  title: string,
  text: string,
  preferShare: boolean,
): Promise<{ ok: boolean; message?: string; via?: "share" | "download" }> {
  const blob = bytesToBlob(bytes, "application/pdf");
  const file = receiptPdfFile(bytes, fileName);
  if (preferShare && typeof navigator !== "undefined") {
    try {
      const canShareFiles =
        typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
      if (canShareFiles && typeof navigator.share === "function") {
        await navigator.share({ files: [file], title });
        return { ok: true, via: "share" };
      }
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text });
        return { ok: true, via: "share" };
      }
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error ?? "");
      if (/cancel/i.test(raw)) return { ok: false, message: "Cancelled" };
    }
  }
  await downloadBlob(fileName, blob);
  return { ok: true, via: "download" };
}

export async function shareReceiptOnDevice(
  input: ReceiptPayload | Record<string, unknown>,
): Promise<{ ok: boolean; message?: string; via?: "share" | "download" }> {
  const payload = normalizeReceiptPayload(input);
  const title = `Receipt ${payload.invoiceNumber}`;
  const bytes = await buildReceiptPdfBytes(payload);
  const fileName = `receipt-${payload.invoiceNumber}.pdf`;
  return offerReceiptPdf(bytes, fileName, title, buildReceiptShareText(payload), true);
}

export async function saveReceiptPdfOnDevice(
  input: ReceiptPayload | Record<string, unknown>,
): Promise<{ ok: boolean; message?: string; via?: "share" | "download" }> {
  const payload = normalizeReceiptPayload(input);
  const bytes = await buildReceiptPdfBytes(payload);
  const fileName = `receipt-${payload.invoiceNumber}.pdf`;
  return offerReceiptPdf(bytes, fileName, `Receipt ${payload.invoiceNumber}`, "", false);
}

/** Build a compact PDF receipt for save / share on mobile. */
export async function buildReceiptPdfBytes(
  input: ReceiptPayload | Record<string, unknown>,
): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const payload = normalizeReceiptPayload(input);
  const text = buildReceiptShareText(payload);
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, Math.max(120, 20 + text.split("\n").length * 5)],
  });
  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  const margin = 4;
  let y = 8;
  for (const line of text.split("\n")) {
    doc.text(line || " ", margin, y, { maxWidth: 72 });
    y += 4.5;
    if (y > doc.internal.pageSize.getHeight() - 8) {
      doc.addPage();
      y = 8;
    }
  }
  const arrayBuffer = doc.output("arraybuffer");
  return new Uint8Array(arrayBuffer);
}
