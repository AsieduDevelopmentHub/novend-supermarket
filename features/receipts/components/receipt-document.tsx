"use client";

import { RECEIPT_VENDOR_FOOTER } from "@/constants/app";
import { formatCurrencyEscPos } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import type { ReceiptPayload, ReceiptTemplateConfig, ReceiptBusiness } from "../types";
import { SAMPLE_RECEIPT_PAYLOAD } from "../types";
import { sanitizeReceiptCopy } from "@/lib/receipt-print-mode";
import { receiptPaymentLines } from "../payment-lines";
import { formatReceiptLineTitle } from "../line-title";
import { cn } from "@/lib/utils";

type Props = {
  payload: ReceiptPayload;
  /** Override live template when designing (preview). */
  templateOverride?: Partial<ReceiptTemplateConfig>;
  businessOverride?: Partial<ReceiptBusiness>;
  className?: string;
  preview?: boolean;
};

/** Match ESC/POS / thermal output — ASCII `GHS` (₵ prints as ? on most printers). */
const money = formatCurrencyEscPos;

export function ReceiptDocument({
  payload,
  templateOverride,
  businessOverride,
  className,
  preview = false,
}: Props) {
  const template = {
    ...SAMPLE_RECEIPT_PAYLOAD.template,
    ...payload.template,
    ...templateOverride,
  };
  const business = {
    ...SAMPLE_RECEIPT_PAYLOAD.business,
    ...payload.business,
    ...businessOverride,
  };
  const widthClass = template.paperWidthMm === 58 ? "w-[220px]" : "w-[302px]";
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  const headerLine = sanitizeReceiptCopy(template.headerText, "");
  const paymentLines = receiptPaymentLines(payload);
  const tradeName =
    business.tradeName?.trim() || SAMPLE_RECEIPT_PAYLOAD.business.tradeName;
  const branchName = business.branchName?.trim() || "";
  const showBranch =
    Boolean(branchName) && branchName.toLowerCase() !== tradeName.toLowerCase();

  return (
    <div
      className={cn(
        "receipt-document bg-white text-black",
        widthClass,
        preview ? "border-border rounded-md border shadow-sm" : "",
        className,
      )}
      style={{
        fontFamily: "Consolas, 'Courier New', ui-monospace, monospace",
      }}
    >
      <div className="space-y-2 px-3 py-4 text-[11px] leading-tight">
        <div className="text-center">
          <p className="text-base font-extrabold tracking-wide uppercase">{tradeName}</p>
          {headerLine ? <p className="mt-0.5">{headerLine}</p> : null}
          {showBranch ? <p className="mt-0.5">{branchName}</p> : null}
          {business.address ? <p>{business.address}</p> : null}
          {business.phone ? <p>Tel: {business.phone}</p> : null}
          {business.email ? <p>{business.email}</p> : null}
          {business.taxId ? <p>TIN: {business.taxId}</p> : null}
        </div>

        <div className="border-t border-dashed border-black/40 pt-2">
          {payload.kind === "return" ? <p className="font-bold tracking-wide">RETURN</p> : null}
          <p>Invoice: {payload.invoiceNumber}</p>
          {payload.kind === "return" && payload.originalInvoiceNumber ? (
            <p>Original: {payload.originalInvoiceNumber}</p>
          ) : null}
          <p>{formatDateTime(payload.completedAt)}</p>
          {template.showCashier && payload.cashierName ? (
            <p>Cashier: {payload.cashierName}</p>
          ) : null}
          {template.showCustomer ? <p>Customer: {payload.customerName}</p> : null}
          {template.showPaymentMethod && !paymentLines ? (
            <p className="capitalize">
              {payload.kind === "return" ? "Refund" : "Payment"}:{" "}
              {payload.paymentMethod.replace("_", " ")}
            </p>
          ) : null}
          {template.showPaymentMethod && paymentLines ? <p>Payment: Split</p> : null}
          {payload.kind === "return" && payload.returnReason ? (
            <p>Reason: {payload.returnReason}</p>
          ) : null}
        </div>

        <div className="border-t border-dashed border-black/40 pt-2">
          {lines.map((line, index) => {
            const title = formatReceiptLineTitle(line, index + 1);
            return (
            <div key={`${line.productName}-${line.sellUnitLabel ?? ""}-${index}`} className="mb-3">
              {template.paperWidthMm === 58 ? (
                <>
                  <p className="font-medium break-words">{title}</p>
                  <div className="flex justify-between gap-2 text-black/70">
                    <span>
                      {line.quantity} x {money(line.unitPrice)}
                      {line.discount > 0 ? ` (-${money(line.discount)})` : ""}
                    </span>
                    <span className="shrink-0 text-black">{money(line.lineTotal)}</span>
                  </div>
                  {template.showSku && line.sku ? (
                    <p className="text-black/70">{line.sku}</p>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{title}</span>
                    <span>{money(line.lineTotal)}</span>
                  </div>
                  <div className="text-black/70">
                    {line.quantity} x {money(line.unitPrice)}
                    {line.discount > 0 ? ` (-${money(line.discount)})` : ""}
                    {template.showSku && line.sku ? ` - ${line.sku}` : ""}
                  </div>
                </>
              )}
            </div>
            );
          })}
        </div>

        <div className="space-y-0.5 border-t border-dashed border-black/40 pt-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{money(payload.subtotal)}</span>
          </div>
          {payload.discount > 0 ? (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>{money(payload.discount)}</span>
            </div>
          ) : null}
          {typeof payload.taxNet === "number" && typeof payload.taxAmount === "number" ? (
            <>
              <div className="flex justify-between">
                <span>Net</span>
                <span>{money(payload.taxNet)}</span>
              </div>
              <div className="flex justify-between">
                <span>
                  {payload.taxLabel ?? "VAT"}
                  {typeof payload.taxRatePercent === "number"
                    ? ` (${payload.taxRatePercent}%)`
                    : ""}
                </span>
                <span>{money(payload.taxAmount)}</span>
              </div>
            </>
          ) : null}
          <div className="flex justify-between text-base font-extrabold">
            <span>{payload.kind === "return" ? "REFUND" : "TOTAL"}</span>
            <span>{money(payload.total)}</span>
          </div>
          {template.showPaymentMethod && paymentLines
            ? paymentLines.map((line, index) => (
                <div key={`${line.label}-${index}`} className="flex justify-between">
                  <span>{line.label}</span>
                  <span>{money(line.amount)}</span>
                </div>
              ))
            : null}
          {typeof payload.amountPaid === "number" ? (
            <>
              <div className="flex justify-between">
                <span>Paid</span>
                <span>{money(payload.amountPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span>Change</span>
                <span>{money(payload.changeGiven ?? 0)}</span>
              </div>
            </>
          ) : null}
        </div>

        <div className="border-t border-dashed border-black/40 pt-2 text-center">
          {template.footerText ? <p>{template.footerText}</p> : null}
          {template.thankYouLine ? <p className="mt-1">{template.thankYouLine}</p> : null}
          <p className="mt-2 text-[10px] text-black/70">{RECEIPT_VENDOR_FOOTER}</p>
        </div>
      </div>
    </div>
  );
}
