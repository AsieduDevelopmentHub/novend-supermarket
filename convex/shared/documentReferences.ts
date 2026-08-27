import { TEXT_LIMITS, sanitizeText } from "./validation";

const INVOICE_PREFIX = "INV-";
const RETURN_PREFIX = "RET-";

function allocateReference(prefix: "INV" | "RET"): string {
  return `${prefix}-${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
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
