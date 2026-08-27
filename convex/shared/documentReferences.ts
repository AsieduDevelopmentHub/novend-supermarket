import { TEXT_LIMITS, sanitizeText } from "./validation";

const INVOICE_PREFIXES = ["INV-", "OFF-"] as const;
const RETURN_PREFIXES = ["RET-"] as const;

function allocateReference(prefix: "INV" | "RET"): string {
  return `${prefix}-${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
}

function sanitizeReference(
  value: string,
  label: string,
  prefixes: readonly string[],
): string {
  const cleaned = sanitizeText(value, label, TEXT_LIMITS.code).toUpperCase();
  if (!prefixes.some((prefix) => cleaned.startsWith(prefix))) {
    throw new Error(`Invalid ${label.toLowerCase()}`);
  }
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(cleaned)) {
    throw new Error(`Invalid ${label.toLowerCase()}`);
  }
  return cleaned;
}

/** Canonical invoice printed at checkout. Stable across offline sync. */
export function allocateInvoiceNumber(): string {
  return allocateReference("INV");
}

export function sanitizeInvoiceNumber(value: string): string {
  return sanitizeReference(value, "Invoice number", INVOICE_PREFIXES);
}

/** Canonical return number printed on the return receipt. */
export function allocateReturnNumber(): string {
  return allocateReference("RET");
}

export function sanitizeReturnNumber(value: string): string {
  return sanitizeReference(value, "Return number", RETURN_PREFIXES);
}
