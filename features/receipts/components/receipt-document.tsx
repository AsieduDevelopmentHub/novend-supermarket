"use client";

import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import type { ReceiptPayload, ReceiptTemplateConfig, ReceiptBusiness } from "../types";
import { SAMPLE_RECEIPT_PAYLOAD } from "../types";
import { cn } from "@/lib/utils";

type Props = {
  payload: ReceiptPayload;
  /** Override live template when designing (preview). */
  templateOverride?: Partial<ReceiptTemplateConfig>;
  businessOverride?: Partial<ReceiptBusiness>;
  className?: string;
  preview?: boolean;
};

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

  return (
    <div
      className={cn(
        "receipt-document bg-white text-black",
        widthClass,
        preview ? "border-border rounded-md border shadow-sm" : "",
        className,
      )}
      style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
    >
      <div className="space-y-2 px-3 py-4 text-[11px] leading-tight">
        <div className="text-center">
          <p className="text-sm font-bold tracking-wide uppercase">{business.tradeName}</p>
          {template.headerText ? <p className="mt-0.5">{template.headerText}</p> : null}
          {business.branchName ? <p className="mt-0.5">{business.branchName}</p> : null}
          {business.address ? <p>{business.address}</p> : null}
          {business.phone ? <p>Tel: {business.phone}</p> : null}
          {business.email ? <p>{business.email}</p> : null}
          {business.taxId ? <p>TIN: {business.taxId}</p> : null}
        </div>

        <div className="border-t border-dashed border-black/40 pt-2">
          {payload.kind === "return" ? (
            <p className="font-bold tracking-wide">RETURN</p>
          ) : null}
          <p>Invoice: {payload.invoiceNumber}</p>
          {payload.kind === "return" && payload.originalInvoiceNumber ? (
            <p>Original: {payload.originalInvoiceNumber}</p>
          ) : null}
          <p>{formatDateTime(payload.completedAt)}</p>
          {template.showCashier && payload.cashierName ? (
            <p>Cashier: {payload.cashierName}</p>
          ) : null}
          {template.showCustomer ? <p>Customer: {payload.customerName}</p> : null}
          {template.showPaymentMethod ? (
            <p className="capitalize">
              {payload.kind === "return" ? "Refund" : "Payment"}:{" "}
              {payload.paymentMethod.replace("_", " ")}
            </p>
          ) : null}
          {payload.kind === "return" && payload.returnReason ? (
            <p>Reason: {payload.returnReason}</p>
          ) : null}
        </div>

        <div className="border-t border-dashed border-black/40 pt-2">
          {lines.map((line, index) => (
            <div key={`${line.productName}-${index}`} className="mb-2">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{line.productName}</span>
                <span>{formatCurrency(line.lineTotal)}</span>
              </div>
              <div className="text-black/70">
                {line.quantity} x {formatCurrency(line.unitPrice)}
                {line.discount > 0 ? ` (−${formatCurrency(line.discount)})` : ""}
                {template.showSku && line.sku ? ` · ${line.sku}` : ""}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-0.5 border-t border-dashed border-black/40 pt-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(payload.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Discount</span>
            <span>{formatCurrency(payload.discount)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span>{payload.kind === "return" ? "REFUND" : "TOTAL"}</span>
            <span>{formatCurrency(payload.total)}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-black/40 pt-2 text-center">
          {template.footerText ? <p>{template.footerText}</p> : null}
          {template.thankYouLine ? <p className="mt-1">{template.thankYouLine}</p> : null}
        </div>
      </div>
    </div>
  );
}
