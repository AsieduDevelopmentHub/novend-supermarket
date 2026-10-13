import type { OutboxOpType, OutboxRow, OutboxStatus } from "./types";
import { isConnectivityError } from "@/lib/errors";
import { isDefinitiveBusinessConflict } from "./outbox-policy";
import {
  isAuthRequiredError,
  isSyncBusinessConflict,
  isSyncDependencyWait,
  isTransientSyncPlaceholder,
  sanitizeSyncErrorMessage,
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
  upsert_customer_group: "Customer group",
  upsert_price_rule: "Price rule",
  record_customer_payment: "Customer payment",
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

/** "cash" for a single tender; "cash + on account" when the sale was split. */
function saleTenderSummary(payload: Record<string, unknown>): string | null {
  const lines = Array.isArray(payload.payments) ? payload.payments : [];
  const methods = lines
    .map((line) =>
      line && typeof line === "object" ? text((line as { method?: unknown }).method) : null,
    )
    .filter((method): method is string => method !== null);
  if (methods.length > 1) return methods.map((method) => method.replace(/_/g, " ")).join(" + ");
  return text(payload.paymentMethod)?.replace(/_/g, " ") ?? null;
}

export type CreditConflictKind = "credit_limit" | "credit_disabled" | "customer_required";

/** Receivable rejections need a manager decision, not a generic "sale rejected". */
export function classifyCreditConflict(message: string): CreditConflictKind | null {
  const lower = message.toLowerCase();
  if (lower.includes("credit limit")) return "credit_limit";
  if (lower.includes("customer credit is not enabled")) return "credit_disabled";
  if (lower.includes("choose a customer to sell on account")) return "customer_required";
  return null;
}

const CREDIT_CONFLICT_HEADLINES: Record<CreditConflictKind, string> = {
  credit_limit: "Credit limit exceeded",
  credit_disabled: "Customer credit is not enabled",
  customer_required: "Choose a customer to sell on account",
};

const STOCK_REASON_LABELS: Record<string, string> = {
  receive: "Receive stock",
  adjustment: "Count adjustment",
  damage: "Damage",
  return: "Return to stock",
};

function signedQuantity(value: number) {
  return value > 0 ? `+${value}` : String(value);
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
    const method = saleTenderSummary(payload);
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
  if (row.type === "record_customer_payment") {
    const amount = number(payload.amount);
    return {
      title,
      detail:
        [
          amount === null ? null : `GHS ${amount.toFixed(2)}`,
          text(payload.method)?.replace(/_/g, " "),
        ]
          .filter(Boolean)
          .join(" · ") || "Customer payment waiting to upload",
    };
  }
  if (
    row.type === "upsert_supplier" ||
    row.type === "upsert_customer" ||
    row.type === "upsert_customer_group" ||
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
    const reason = text(payload.reason);
    return {
      title,
      detail:
        [
          text(payload.productName),
          change === null ? null : signedQuantity(change),
          reason ? (STOCK_REASON_LABELS[reason] ?? reason) : null,
          text(payload.note),
        ]
          .filter(Boolean)
          .join(" · ") || "Quantity change",
    };
  }
  if (row.type === "update_lot_expiry") {
    return {
      title,
      detail:
        [text(payload.productName), text(payload.expiryDate)].filter(Boolean).join(" · ") ||
        "Lot expiry",
    };
  }
  if (row.type === "transfer_stock" || row.type === "wholesale_transfer") {
    const qty = number(payload.quantity);
    return {
      title,
      detail:
        [text(payload.productName), qty === null ? null : `${qty} units`, text(payload.note)]
          .filter(Boolean)
          .join(" · ") || "Transfer",
    };
  }
  if (row.type === "dining_open_session" || row.type === "dining_pay_session") {
    return { title, detail: text(payload.tableName) ?? text(payload.customerName) ?? title };
  }
  if (row.type === "dining_add_session_item") {
    const qty = number(payload.quantity);
    return {
      title,
      detail:
        [text(payload.productName), qty === null ? null : `×${qty}`].filter(Boolean).join(" · ") ||
        title,
    };
  }
  if (row.type === "hotel_check_in" || row.type === "hotel_checkout_pay") {
    return { title, detail: text(payload.roomName) ?? text(payload.customerName) ?? title };
  }
  if (row.type === "hotel_add_folio_charge") {
    const qty = number(payload.quantity);
    return {
      title,
      detail:
        [text(payload.description) ?? text(payload.productName), qty === null ? null : `×${qty}`]
          .filter(Boolean)
          .join(" · ") || title,
    };
  }
  if (row.type === "pay_salary" || row.type === "pay_commission") {
    return { title, detail: text(payload.payPeriodKey) ?? text(payload.profileName) ?? title };
  }
  if (row.type === "remove_expense") {
    return { title, detail: text(payload.category) ?? text(payload.note) ?? "Expense removal" };
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
  /** Printed sale the server rejected for stock. A manager can post it. */
  canPostShortage?: boolean;
};

function stockConflictExplanation(message: string, payload: Record<string, unknown>) {
  const invoice = text(payload.invoiceNumber);
  const clean = sanitizeSyncErrorMessage(message) || message;
  const receipt = invoice ? `Receipt ${invoice}. ` : "";
  return `${receipt}${clean} This receipt already left the till. The next sync saves the sale and only removes stock that is still there. Stock does not go below zero.`;
}

/**
 * Cashier-facing conflict copy. Separates retryable network failures from
 * permanent business rejections so a rejected sale is never a generic tech error.
 */
export function describeOutboxConflict(
  row: OutboxRow,
  options?: { cloudConnected?: boolean },
): OutboxConflictView {
  const rawMessage = (row.lastError ?? "").trim();
  const message = sanitizeSyncErrorMessage(rawMessage) || rawMessage;
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
    const reachable = !isConnectivityError(new Error(message));
    return {
      kind: "network",
      headline: isTransientSyncPlaceholder(message)
        ? "Upload interrupted"
        : reachable
          ? "Upload failed"
          : "Could not reach the server",
      explanation: isTransientSyncPlaceholder(message)
        ? `${base.title} (${base.detail}) did not finish uploading. This is not a product or stock conflict — the server sent no reason. Tap Retry. Discard only if this exact record is already saved in Novend.`
        : `${base.title} (${base.detail}) did not upload. ${message} This is not a product conflict — it will retry.`,
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
      headline: "Not enough stock",
      explanation: stockConflictExplanation(message, payload),
      permanent: true,
      canPostShortage: true,
    };
  }

  const creditConflict = row.type === "complete_sale" ? classifyCreditConflict(message) : null;
  if (creditConflict) {
    return {
      kind: "business",
      headline: CREDIT_CONFLICT_HEADLINES[creditConflict],
      explanation: `${base.detail}. ${message} The goods already left the till on account. A manager should raise the customer's limit or record a payment, then retry; otherwise discard and re-ring the sale with another tender.`,
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
