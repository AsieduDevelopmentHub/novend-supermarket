import { randomHexId } from "./randomId";
import { TEXT_LIMITS, sanitizeText } from "./validation";

const INVOICE_PREFIX = "INV-";
const RETURN_PREFIX = "RET-";
const PURCHASE_PREFIX = "PO-";

function allocateReference(prefix: "INV" | "RET" | "PO"): string {
  return `${prefix}-${randomHexId(16)}`;
}

function sanitizeReference(value: string, label: string, prefix: string): string {
  const cleaned = sanitizeText(value, label, TEXT_LIMITS.code).toUpperCase();
  const normalized = cleaned.startsWith("OFF-") ? `${prefix}${cleaned.slice(4)}` : cleaned;
  if (!normalized.startsWith(prefix)) {
    throw new Error(`Invalid ${label.toLowerCase()}`);
  }
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(normalized)) {
    throw new Error(`Invalid ${label.toLowerCase()}`);
  }
  return normalized;
}

/** Canonical invoice printed at checkout. Stable across offline sync. */
export function allocateInvoiceNumber(): string {
  return allocateReference("INV");
}

export function sanitizeInvoiceNumber(value: string): string {
  return sanitizeReference(value, "Invoice number", INVOICE_PREFIX);
}

/** Canonical return number printed on the return receipt. */
export function allocateReturnNumber(): string {
  return allocateReference("RET");
}

export function sanitizeReturnNumber(value: string): string {
  return sanitizeReference(value, "Return number", RETURN_PREFIX);
}

/** Canonical supplier purchase reference. */
export function allocatePurchaseReference(): string {
  return allocateReference("PO");
}

export function sanitizePurchaseReference(value: string): string {
  return sanitizeReference(value, "Purchase reference", PURCHASE_PREFIX);
}
