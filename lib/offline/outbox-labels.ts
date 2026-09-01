import type { OutboxOpType, OutboxRow, OutboxStatus } from "./types";

const OP_LABELS: Record<OutboxOpType, string> = {
  complete_sale: "Sale",
  process_return: "Return",
  upsert_supplier: "Supplier",
  record_wholesale_purchase: "Wholesale purchase",
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
