import { RECEIPT_VENDOR_FOOTER } from "@/constants/app";
import type { ReceiptPayload } from "@/features/receipts/types";
import { parseReceiptPayments, receiptPaymentLines } from "@/features/receipts/payment-lines";
import {
  SAMPLE_RECEIPT_PAYLOAD,
  type ReceiptBusiness,
  type ReceiptLine,
  type ReceiptTemplateConfig,
} from "@/features/receipts/types";
import { formatCurrency } from "@/lib/currency";
import { sanitizeReceiptCopy } from "@/lib/receipt-print-mode";
import { formatDateTime } from "@/lib/date";
import { brandedDocumentName } from "@/lib/export-filenames";
import { probePrintBridge, sendToPrintBridge } from "./print/bridge";
import { appendCashDrawerPulse, buildEscPosReceipt, escPosToBase64 } from "./print/escpos";
import {
  loadTerminalPrinterConfig,
  resolvePaperWidthMm,
  type PrintResult,
} from "./print/terminal-config";
import { isCapacitor } from "@novend/hardware";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function filled(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

/** Ensure older/partial receipt payloads always print safely. */
export function normalizeReceiptPayload(
  raw: Partial<ReceiptPayload> | Record<string, unknown> | null | undefined,
): ReceiptPayload {
  const source = (raw ?? {}) as Partial<ReceiptPayload>;
  const incomingBusiness = (source.business as Partial<ReceiptBusiness> | undefined) ?? {};
  const incomingTemplate = (source.template as Partial<ReceiptTemplateConfig> | undefined) ?? {};
  const sample = SAMPLE_RECEIPT_PAYLOAD.business;
  const business = {
    ...sample,
    ...incomingBusiness,
    tradeName: filled(incomingBusiness.tradeName, sample.tradeName),
    legalName: filled(incomingBusiness.legalName, sample.legalName),
  };
  const template = {
    ...SAMPLE_RECEIPT_PAYLOAD.template,
    ...incomingTemplate,
  };
  const lines = (Array.isArray(source.lines) ? source.lines : []) as ReceiptLine[];

  return {
    invoiceNumber: String(source.invoiceNumber ?? "INV"),
    saleId: source.saleId ? String(source.saleId) : undefined,
    subtotal: Number(source.subtotal ?? 0),
    discount: Number(source.discount ?? 0),
    total: Number(source.total ?? 0),
    itemCount: Number(source.itemCount ?? lines.reduce((n, l) => n + (l.quantity || 0), 0)),
    lines: lines.map((line) => ({
      productName: String(line.productName ?? "Item"),
      sku: line.sku ? String(line.sku) : undefined,
      quantity: Number(line.quantity ?? 0),
      unitPrice: Number(line.unitPrice ?? 0),
      discount: Number(line.discount ?? 0),
      lineTotal: Number(line.lineTotal ?? 0),
    })),
    paymentMethod: String(source.paymentMethod ?? "cash"),
    payments: parseReceiptPayments(source.payments),
    completedAt: Number(source.completedAt ?? Date.now()),
    customerName: String(source.customerName ?? "Walk-in Customer"),
    customerPhone: (source.customerPhone as string | null | undefined) ?? null,
    customerId: source.customerId ? String(source.customerId) : null,
    cashierName: source.cashierName ? String(source.cashierName) : undefined,
    business,
    template: {
      ...template,
      paperWidthMm: template.paperWidthMm === 58 ? 58 : 80,
    },
  };
}

export function buildReceiptPrintHtml(input: ReceiptPayload | Record<string, unknown>) {
  const payload = normalizeReceiptPayload(input);
  const t = payload.template;
  const b = payload.business;
  const splitLines = receiptPaymentLines(payload);
  const widthMm = t.paperWidthMm === 58 ? 58 : 80;
  const widthPx = widthMm === 58 ? 220 : 302;

  const lines = payload.lines
    .map((line) => {
      const meta = [
        `${line.quantity} x ${formatCurrency(line.unitPrice)}`,
        line.discount > 0 ? `(−${formatCurrency(line.discount)})` : "",
        t.showSku && line.sku ? line.sku : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `<div class="line">
        <div class="row"><span>${escapeHtml(line.productName)}</span><span>${escapeHtml(formatCurrency(line.lineTotal))}</span></div>
        <div class="meta">${escapeHtml(meta)}</div>
      </div>`;
    })
    .join("");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const logo = t.showLogo
    ? `<img class="logo" src="${origin}/branding/brandmark.png" alt="" />`
    : "";
  const printTitle = brandedDocumentName("Receipt", payload.invoiceNumber);

  // Avoid @page size: Nmm — Chromium often opens a blank preview with custom page sizes.
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(printTitle || "Receipt")}</title>
  <style>
    @page { margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .ticket { width: ${widthPx}px; max-width: 100%; padding: 12px; }
    .center { text-align: center; }
    .logo { height: 56px; margin: 0 auto 6px; display: block; object-fit: contain; }
    .title { font-size: 14px; font-weight: 700; text-transform: uppercase; }
    .sep { border-top: 1px dashed #000; margin: 8px 0; padding-top: 8px; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .meta { opacity: 0.75; margin-bottom: 6px; }
    .total { font-size: 14px; font-weight: 700; }
    .vendor { margin-top: 6px; font-size: 10px; opacity: 0.75; }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="center">
      ${logo}
      <div class="title">${escapeHtml(b.tradeName || "Receipt")}</div>
      ${sanitizeReceiptCopy(t.headerText, "") ? `<div>${escapeHtml(sanitizeReceiptCopy(t.headerText, ""))}</div>` : ""}
      ${b.branchName ? `<div>${escapeHtml(b.branchName)}</div>` : ""}
      ${b.address ? `<div>${escapeHtml(b.address)}</div>` : ""}
      ${b.phone ? `<div>Tel: ${escapeHtml(b.phone)}</div>` : ""}
      ${b.email ? `<div>${escapeHtml(b.email)}</div>` : ""}
      ${b.taxId ? `<div>TIN: ${escapeHtml(b.taxId)}</div>` : ""}
    </div>
    <div class="sep">
      <div>Invoice: ${escapeHtml(payload.invoiceNumber)}</div>
      <div>${escapeHtml(formatDateTime(payload.completedAt))}</div>
      ${t.showCashier && payload.cashierName ? `<div>Cashier: ${escapeHtml(payload.cashierName)}</div>` : ""}
      ${t.showCustomer ? `<div>Customer: ${escapeHtml(payload.customerName)}</div>` : ""}
      ${t.showPaymentMethod ? `<div>Payment: ${splitLines ? "Split" : escapeHtml(payload.paymentMethod.replace("_", " "))}</div>` : ""}
    </div>
    <div class="sep">${lines || "<div>No line items</div>"}</div>
    <div class="sep">
      <div class="row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(payload.subtotal))}</span></div>
      <div class="row"><span>Discount</span><span>${escapeHtml(formatCurrency(payload.discount))}</span></div>
      <div class="row total"><span>TOTAL</span><span>${escapeHtml(formatCurrency(payload.total))}</span></div>
      ${t.showPaymentMethod && splitLines ? splitLines.map((split) => `<div class="row"><span>${escapeHtml(split.label)}</span><span>${escapeHtml(formatCurrency(split.amount))}</span></div>`).join("") : ""}
    </div>
    <div class="sep center">
      ${t.footerText ? `<div>${escapeHtml(t.footerText)}</div>` : ""}
      ${t.thankYouLine ? `<div>${escapeHtml(t.thankYouLine)}</div>` : ""}
      <div class="vendor">${escapeHtml(RECEIPT_VENDOR_FOOTER)}</div>
    </div>
  </div>
</body>
</html>`;
}

function waitForImages(doc: Document) {
  const images = Array.from(doc.images);
  if (images.length === 0) return Promise.resolve();
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  ).then(() => undefined);
}

/**
 * Print via browser dialog (HTML iframe). Fallback when the desktop bridge is unavailable.
 */
export async function printReceiptBrowser(input: ReceiptPayload | Record<string, unknown>) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    console.info("[print:stub]", (input as ReceiptPayload).invoiceNumber);
    return { printed: false as const, reason: "ssr" as const };
  }

  const payload = normalizeReceiptPayload(input);
  const html = buildReceiptPrintHtml(payload);
  const widthPx = payload.template.paperWidthMm === 58 ? 220 : 302;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", `Receipt ${payload.invoiceNumber}`);
  iframe.setAttribute(
    "style",
    [
      "position:fixed",
      "top:0",
      // Off-screen but real size — do not use 0×0, opacity:0, or clip-path (blank Chromium prints).
      `left:-${widthPx + 80}px`,
      `width:${widthPx}px`,
      "height:1600px",
      "border:0",
      "margin:0",
      "padding:0",
      "background:#fff",
      "opacity:1",
      "visibility:visible",
      "pointer-events:none",
      "z-index:-1",
    ].join(";"),
  );

  const cleanup = () => {
    window.setTimeout(() => {
      iframe.remove();
    }, 2000);
  };

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        reject(new Error("Print iframe load timeout"));
      }, 5000);
      iframe.onload = () => {
        window.clearTimeout(timer);
        resolve();
      };
      iframe.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("Print iframe failed to load"));
      };
      // Blob URL so Chromium does not stamp the POS route (e.g. /dashboard) into print headers.
      iframe.src = blobUrl;
      document.body.appendChild(iframe);
    });

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc?.body || doc.body.childElementCount === 0) {
      throw new Error("Print iframe document empty");
    }

    await waitForImages(doc);
    await new Promise((r) => window.requestAnimationFrame(() => r(undefined)));
    await new Promise((r) => window.setTimeout(r, 150));

    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    cleanup();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    return { printed: true as const, reason: "iframe" as const };
  } catch (error) {
    console.error("[print:failed]", error);
    cleanup();
    URL.revokeObjectURL(blobUrl);
    return { printed: false as const, reason: "iframe_failed" as const };
  }
}

/**
 * Prefer silent native ESC/POS via the Electron desktop bridge; fall back to browser print.
 */
export async function printReceipt(
  input: ReceiptPayload | Record<string, unknown>,
  options?: { forceBrowser?: boolean },
): Promise<PrintResult> {
  if (typeof window === "undefined") {
    return { printed: false, reason: "ssr" };
  }

  const payload = normalizeReceiptPayload(input);
  const config = loadTerminalPrinterConfig();

  if (!options?.forceBrowser && isCapacitor()) {
    try {
      const { Hardware, bluetoothPrintFailedMessage } = await import("@novend/hardware");
      const { resolveMobilePaperWidthMm } = await import("./print/terminal-config");
      const status = await Hardware.bluetoothPrinter.getStatus();
      const paperWidthMm = resolveMobilePaperWidthMm({
        savedPaperWidthMm: status.data?.paperWidthMm,
        templatePaperWidthMm: payload.template.paperWidthMm,
      });
      const receiptBytes = buildEscPosReceipt(payload, paperWidthMm);
      // Cap Bluetooth writes raw ESC/POS only — embed the drawer pulse in the payload.
      const bytes = config.openCashDrawer ? appendCashDrawerPulse(receiptBytes) : receiptBytes;
      const defaultPrinter = await Hardware.printer.getDefaultPrinter();
      const result = await Hardware.printer.printReceipt({
        escposBase64: escPosToBase64(bytes),
        invoiceNumber: payload.invoiceNumber,
        copies: 1,
        connectionType: defaultPrinter.data?.connectionType ?? "bluetooth",
        bluetoothDeviceId: defaultPrinter.data?.bluetoothDeviceId,
        paperWidthMm,
        openCashDrawer: config.openCashDrawer,
      });
      if (result.ok) {
        return { printed: true, reason: "native", copies: 1 };
      }
      console.warn("[print:capacitor-failed]", result.message);
      return {
        printed: false,
        reason: "native_unavailable",
        failureCode: result.code,
        failureMessage: result.message || bluetoothPrintFailedMessage(result.code),
      };
    } catch (error) {
      console.warn("[print:capacitor-error]", error);
    }
    return { printed: false, reason: "native_unavailable" };
  }

  if (!options?.forceBrowser && config.preferNative) {
    const status = await probePrintBridge();
    if (status.ok) {
      try {
        const paperWidthMm = resolvePaperWidthMm(payload, config);
        const bytes = buildEscPosReceipt(payload, paperWidthMm);
        const result = await sendToPrintBridge({
          escposBase64: escPosToBase64(bytes),
          invoiceNumber: payload.invoiceNumber,
          copies: config.copies,
          connectionType: config.connectionType,
          printerHost: config.printerHost,
          printerPort: config.printerPort,
          windowsPrinterName: config.windowsPrinterName,
          paperWidthMm,
          openCashDrawer: config.openCashDrawer,
        });
        if (result.ok) {
          return { printed: true, reason: "native", copies: config.copies };
        }
        console.warn("[print:native-failed]", result.message);
      } catch (error) {
        console.warn("[print:native-error]", error);
      }
    }
  }

  return printReceiptBrowser(payload);
}

export {
  loadTerminalPrinterConfig,
  saveTerminalPrinterConfig,
  DEFAULT_TERMINAL_PRINTER_CONFIG,
  type TerminalPrinterConfig,
  type PrintResult,
} from "./print/terminal-config";

export {
  probePrintBridge,
  discoverPrinters,
  testDesktopPrint,
  isDesktopRuntime,
} from "./print/bridge";
export { buildEscPosReceipt, buildEscPosBarcode, buildEscPosQr } from "./print/escpos";
export type { DiscoveredWindowsPrinter, PrinterDiscoveryResult } from "./print/bridge";
