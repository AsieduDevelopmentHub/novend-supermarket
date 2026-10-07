import type { OutboxOpType, OutboxRow, OutboxStatus } from "./types";
import { isConnectivityError } from "@/lib/errors";
import { isDefinitiveBusinessConflict } from "./outbox-policy";
import {
  isAuthRequiredError,
  isSyncBusinessConflict,
  isSyncDependencyWait,
  isTransientSyncPlaceholder,
} from "./sync-errors";

const OP_LABELS: Record<OutboxOpType, string> = {
  complete_sale: "Sale",
  dining_open_session: "Open table check",
  dining_add_session_item: "Add check item",
  dining_fire_kitchen_ticket: "Send kitchen ticket",
  dining_pay_session: "Pay table check",
  hotel_create_reservation: "Create reservation",
  hotel_check_in: "Hotel check-in",
  hotel_add_folio_charge: "Folio charge",
  hotel_checkout_pay: "Hotel checkout",
  process_return: "Return",
  upsert_supplier: "Supplier",
  record_wholesale_purchase: "Wholesale purchase",
  record_supplier_payment: "Supplier payment",
  wholesale_transfer: "Wholesale transfer",
  adjust_stock: "Stock adjustment",
  update_lot_expiry: "Lot expiry",
  transfer_stock: "Stock transfer",
  upsert_customer: "Customer",
  create_expense: "Expense",
  remove_expense: "Remove expense",
  update_profile: "Profile",
  create_user: "User account",
  upsert_product: "Product",
  create_category: "Category",
  upsert_branch: "Branch",
  upsert_staff_compensation: "Staff compensation",
  pay_salary: "Salary payment",
  pay_commission: "Commission payment",
};

export function outboxOpLabel(type: OutboxOpType | string) {
  return OP_LABELS[type as OutboxOpType] ?? "Sync event";
}

export function outboxStatusLabel(status: OutboxStatus) {
  if (status === "failed") return "Conflict";
  if (status === "syncing") return "Uploading";
  if (status === "synced") return "Synced";
  if (status === "blocked_by_entitlement") return "Blocked by plan";
  return "Waiting";
}

function payloadRecord(row: OutboxRow): Record<string, unknown> {
  try {
    const parsed = JSON.parse(row.payloadJson) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore malformed payload */
  }
  return {};
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function outboxFixPath(row: OutboxRow): string | null {
  const payload = payloadRecord(row);
  if (row.type === "upsert_product") {
    const id = text(payload.localId) ?? text(payload.serverId);
    return id ? `/products/${id}` : null;
  }
  return null;
}

/** Short cashier-facing title + detail for an outbox row. */
export function describeOutboxEvent(row: OutboxRow): { title: string; detail: string } {
  const payload = payloadRecord(row);
  const title = outboxOpLabel(row.type);

  if (row.type === "complete_sale") {
    const customer = text(payload.customerName);
    const method = text(payload.paymentMethod)?.replace(/_/g, " ");
    const invoice = text(payload.invoiceNumber);
    return {
      title,
      detail:
        [invoice, customer, method].filter(Boolean).join(" · ") || "Checkout waiting to upload",
    };
  }
  if (row.type === "process_return") {
    return {
      title,
      detail: text(payload.returnNumber) ?? text(payload.reason) ?? "Return waiting to upload",
    };
  }
  if (
    row.type === "upsert_supplier" ||
    row.type === "upsert_customer" ||
    row.type === "upsert_product"
  ) {
    const name = text(payload.name);
    const sku = text(payload.sku);
    return { title, detail: [name, sku].filter(Boolean).join(" · ") || title };
  }
  if (
    row.type === "create_category" ||
    row.type === "create_user" ||
    row.type === "upsert_branch"
  ) {
    return { title, detail: text(payload.name) ?? text(payload.code) ?? title };
  }
  if (row.type === "record_wholesale_purchase") {
    return { title, detail: text(payload.invoiceNumber) ?? "Purchase waiting to upload" };
  }
  if (row.type === "record_supplier_payment") {
    const amount = number(payload.amount);
    return { title, detail: amount === null ? "Supplier payment" : `GHS ${amount.toFixed(2)}` };
  }
  if (row.type === "adjust_stock") {
    const change = number(payload.quantityChange);
    return {
      title,
      detail: change === null ? "Quantity change" : change > 0 ? `+${change}` : String(change),
    };
  }
  if (row.type === "update_lot_expiry") {
    return { title, detail: text(payload.expiryDate) ?? "Lot expiry" };
  }
  if (row.type === "transfer_stock" || row.type === "wholesale_transfer") {
    const qty = number(payload.quantity);
    return { title, detail: qty === null ? "Transfer" : `${qty} units` };
  }
  if (row.type === "create_expense") {
    const amount = number(payload.amount);
    return { title, detail: amount === null ? "Expense" : `GHS ${amount.toFixed(2)}` };
  }
  if (row.type === "update_profile") {
    return { title, detail: text(payload.name) ?? "Profile update" };
  }

  return { title, detail: row.lastError ?? "Waiting to upload" };
}

export type OutboxConflictKind = "network" | "waiting" | "business";

export type OutboxConflictView = {
  kind: OutboxConflictKind;
  headline: string;
  explanation: string;
  /** True when Retry is unlikely to help without a data change. */
  permanent: boolean;
};

function stockConflictExplanation(message: string, payload: Record<string, unknown>) {
  const invoice = text(payload.invoiceNumber);
  const product = text(payload.productName) ?? text(payload.name) ?? text(payload.sku);
  const requested = number(payload.quantity) ?? number(payload.requestedQuantity);
  const available = number(payload.availableQuantity) ?? number(payload.currentStock);
  const parts = [
    invoice ? `Receipt ${invoice}` : null,
    product ? `product ${product}` : null,
    requested !== null ? `requested ${requested}` : null,
    available !== null ? `server has ${available}` : null,
  ].filter(Boolean);
  const subject = parts.length > 0 ? `${parts.join(" · ")}. ` : "";
  return `${subject}${message} This sale did not finish on the server — fix stock or discard the local event, then retry.`;
}

/**
 * Cashier-facing conflict copy. Separates retryable network failures from
 * permanent business rejections so a rejected sale is never a generic tech error.
 */
export function describeOutboxConflict(
  row: OutboxRow,
  options?: { cloudConnected?: boolean },
): OutboxConflictView {
  const message = (row.lastError ?? "").trim();
  const base = describeOutboxEvent(row);
  const payload = payloadRecord(row);

  if (row.status === "blocked_by_entitlement") {
    return {
      kind: "business",
      headline: `${base.title} blocked by workspace settings`,
      explanation:
        message ||
        `${base.detail}. This feature isn’t enabled for your workspace. The event was kept for review and was not deleted.`,
      permanent: true,
    };
  }

  if (!message) {
    return {
      kind: "business",
      headline: `${base.title} needs a review`,
      explanation: `${base.detail}. Open Fix or discard this event so it does not look complete on this device only.`,
      permanent: true,
    };
  }

  if (isSyncDependencyWait(message)) {
    return {
      kind: "waiting",
      headline: "Waiting on another upload",
      explanation: `${base.title}: ${message}`,
      permanent: false,
    };
  }

  if (isAuthRequiredError(message)) {
    if (options?.cloudConnected) {
      return {
        kind: "network",
        headline: "Ready to upload",
        explanation: `${base.title} (${base.detail}) is still queued on this device. Tap Retry or Sync now — you are already signed in.`,
        permanent: false,
      };
    }
    return {
      kind: "waiting",
      headline: "Sign in online to upload",
      explanation: `${base.title} (${base.detail}) is saved on this device. Sign in with email and password while online, then tap Sync now.`,
      permanent: false,
    };
  }

  if (
    isTransientSyncPlaceholder(message) ||
    isConnectivityError(new Error(message)) ||
    !isSyncBusinessConflict(message)
  ) {
    return {
      kind: "network",
      headline: isTransientSyncPlaceholder(message)
        ? "Upload interrupted"
        : "Could not reach the server",
      explanation: isTransientSyncPlaceholder(message)
        ? `${base.title} (${base.detail}) did not finish uploading. Tap Retry or Sync now. If it already appears in Orders, Discard this queue row.`
        : `${base.title} (${base.detail}) will retry when you are online. This is not a permanent rejection.`,
      permanent: false,
    };
  }

  const lower = message.toLowerCase();
  const stockRelated =
    lower.includes("insufficient stock") ||
    lower.includes("not enough stock") ||
    lower.includes("stock");

  if (row.type === "complete_sale" && stockRelated) {
    return {
      kind: "business",
      headline: "Sale rejected — not enough stock",
      explanation: stockConflictExplanation(message, payload),
      permanent: true,
    };
  }

  if (row.type === "complete_sale") {
    return {
      kind: "business",
      headline: "Sale rejected by the server",
      explanation: `${base.detail}. ${message} The local checkout is not a completed cloud sale until this is fixed or discarded.`,
      permanent: isDefinitiveBusinessConflict(message),
    };
  }

  return {
    kind: "business",
    headline: `${base.title} was rejected`,
    explanation: `${base.detail}. ${message}`,
    permanent: isDefinitiveBusinessConflict(message),
  };
}
