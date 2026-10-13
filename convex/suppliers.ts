import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { requireRole } from "./shared/permissions";
import { writeAuditLog } from "./shared/audit";
import { rememberClientOp, replayClientOp } from "./shared/clientOps";
import { settlementMethodValidator } from "./shared/paymentMethod";
import {
  allocateSupplierPayment,
  purchaseBalance,
  purchasePaymentStatus,
  settledAmount,
} from "./shared/supplierFinance";
import {
  assertPositiveMoney,
  roundMoney,
  sanitizeEmail,
  sanitizeOptionalText,
  sanitizePhone,
  sanitizeText,
  TEXT_LIMITS,
} from "./shared/validation";

function summarizePurchases(rows: Doc<"supplierPurchases">[]) {
  let purchased = 0;
  let paid = 0;
  let owed = 0;
  for (const row of rows) {
    if (row.status !== "completed") continue;
    purchased += row.totalCost;
    paid += settledAmount(row);
    owed += purchaseBalance(row);
  }
  return {
    purchased: roundMoney(purchased),
    paid: roundMoney(paid),
    owed: roundMoney(owed),
  };
}

export const list = query({
  args: {
    search: v.optional(v.string()),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    let rows = await ctx.db
      .query("suppliers")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    if (!args.includeInactive) {
      rows = rows.filter((row) => row.status === "active");
    }
    if (args.search?.trim()) {
      const q = args.search.trim().toLowerCase();
      rows = rows.filter(
        (row) =>
          row.name.toLowerCase().includes(q) ||
          (row.contactName?.toLowerCase().includes(q) ?? false) ||
          (row.phone?.includes(q) ?? false),
      );
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const get = query({
  args: { id: v.id("suppliers") },
  handler: async (ctx, args) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const supplier = await ctx.db.get(args.id);
    if (!supplier || supplier.organizationId !== organizationId) return null;
    const purchases = await ctx.db
      .query("supplierPurchases")
      .withIndex("by_supplier", (q) => q.eq("supplierId", args.id))
      .collect();
    const completed = purchases.filter((p) => p.status === "completed");
    const totals = summarizePurchases(completed);
    const recent = completed.sort((a, b) => b.purchasedAt - a.purchasedAt).slice(0, 50);
    const itemGroups = await Promise.all(
      recent.map((row) =>
        ctx.db
          .query("supplierPurchaseItems")
          .withIndex("by_purchase", (q) => q.eq("purchaseId", row._id))
          .collect(),
      ),
    );
    const payments = await ctx.db
      .query("supplierPayments")
      .withIndex("by_supplier", (q) => q.eq("supplierId", args.id))
      .collect();
    const referenceByPurchase = new Map(purchases.map((row) => [row._id, row.reference]));
    return {
      ...supplier,
      purchaseCount: completed.length,
      purchaseTotal: totals.purchased,
      purchased: totals.purchased,
      paid: totals.paid,
      owed: totals.owed,
      purchases: recent.map((row, index) => ({
        id: row._id,
        reference: row.reference,
        invoiceNumber: row.invoiceNumber ?? null,
        purchasedAt: row.purchasedAt,
        itemCount: row.itemCount,
        totalCost: row.totalCost,
        amountPaid: row.amountPaid ?? null,
        balance: purchaseBalance(row),
        paymentStatus: purchasePaymentStatus(row),
        legacy: row.amountPaid === undefined,
        notes: row.notes ?? null,
        items: (itemGroups[index] ?? []).map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitCost: item.unitCost,
          lineTotal: item.lineTotal,
        })),
      })),
      payments: payments
        .sort((a, b) => b.paidAt - a.paidAt)
        .slice(0, 100)
        .map((row) => ({
          id: row._id,
          purchaseId: row.purchaseId ?? null,
          purchaseReference: row.purchaseId
            ? (referenceByPurchase.get(row.purchaseId) ?? null)
            : null,
          amount: row.amount,
          paidAt: row.paidAt,
          method: row.method,
          note: row.note ?? null,
        })),
    };
  },
});

export const balances = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const purchases = await ctx.db
      .query("supplierPurchases")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const bySupplier = new Map<string, Doc<"supplierPurchases">[]>();
    for (const row of purchases) {
      const key = row.supplierId;
      const list = bySupplier.get(key) ?? [];
      list.push(row);
      bySupplier.set(key, list);
    }
    return [...bySupplier.entries()].map(([supplierId, rows]) => ({
      supplierId,
      ...summarizePurchases(rows),
    }));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    contactName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const name = sanitizeText(args.name, "Supplier name", TEXT_LIMITS.name);
    const id = await ctx.db.insert("suppliers", {
      organizationId,
      name,
      contactName: sanitizeOptionalText(args.contactName, "Contact", TEXT_LIMITS.name),
      phone: sanitizePhone(args.phone),
      email: sanitizeEmail(args.email),
      address: sanitizeOptionalText(args.address, "Address", TEXT_LIMITS.address),
      notes: sanitizeOptionalText(args.notes, "Notes", TEXT_LIMITS.note),
      status: "active",
      createdAt: Date.now(),
    });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "create_supplier",
      entityType: "suppliers",
      entityId: id,
      organizationId,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("suppliers"),
    name: v.string(),
    contactName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new Error("Supplier not found");
    }
    await ctx.db.patch(args.id, {
      name: sanitizeText(args.name, "Supplier name", TEXT_LIMITS.name),
      contactName: sanitizeOptionalText(args.contactName, "Contact", TEXT_LIMITS.name),
      phone: sanitizePhone(args.phone),
      email: sanitizeEmail(args.email),
      address: sanitizeOptionalText(args.address, "Address", TEXT_LIMITS.address),
      notes: sanitizeOptionalText(args.notes, "Notes", TEXT_LIMITS.note),
      status: args.status,
    });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "update_supplier",
      entityType: "suppliers",
      entityId: args.id,
      organizationId,
    });
    return args.id;
  },
});

export const recordPayment = mutation({
  args: {
    supplierId: v.id("suppliers"),
    purchaseId: v.optional(v.id("supplierPurchases")),
    amount: v.number(),
    paidAt: v.number(),
    method: settlementMethodValidator,
    note: v.optional(v.string()),
    clientOperationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const replay = await replayClientOp<{ paymentIds: string[] }>(
      ctx,
      organizationId,
      args.clientOperationId,
    );
    if (replay) return replay;
    const supplier = await ctx.db.get(args.supplierId);
    if (!supplier || supplier.organizationId !== organizationId) {
      throw new Error("Supplier not found");
    }
    assertPositiveMoney(args.amount, "amount paid");
    const amount = roundMoney(args.amount);
    if (amount <= 0) throw new Error("Enter an amount greater than zero");
    if (!Number.isFinite(args.paidAt)) throw new Error("Invalid payment date");
    const purchases = await ctx.db
      .query("supplierPurchases")
      .withIndex("by_supplier", (q) => q.eq("supplierId", args.supplierId))
      .collect();
    const owned = purchases.filter((row) => row.organizationId === organizationId);
    const allocation = allocateSupplierPayment(
      owned.map((row) => ({
        id: row._id,
        purchasedAt: row.purchasedAt,
        totalCost: row.totalCost,
        amountPaid: row.amountPaid,
        status: row.status,
      })),
      amount,
      args.purchaseId,
    );
    if (allocation.allocations.length === 0 || allocation.unapplied > 0.001) {
      throw new Error("That payment is more than this supplier is owed");
    }
    const note = sanitizeOptionalText(args.note, "Note", TEXT_LIMITS.note);
    const paymentIds: string[] = [];
    for (const part of allocation.allocations) {
      const purchase = owned.find((row) => row._id === part.id);
      if (!purchase) throw new Error("Delivery not found");
      await ctx.db.patch(purchase._id, {
        amountPaid: roundMoney(settledAmount(purchase) + part.applied),
      });
      const paymentId = await ctx.db.insert("supplierPayments", {
        organizationId,
        supplierId: args.supplierId,
        purchaseId: purchase._id,
        amount: part.applied,
        paidAt: args.paidAt,
        method: args.method,
        note,
        recordedBy: userId,
        createdAt: Date.now(),
      });
      paymentIds.push(paymentId);
    }
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "supplier_payment",
      entityType: "supplierPayments",
      entityId: paymentIds[0],
      organizationId,
      metadata: { supplierId: args.supplierId, amount, purchaseId: args.purchaseId ?? null },
    });
    const result = { paymentIds };
    await rememberClientOp(ctx, {
      organizationId,
      clientOperationId: args.clientOperationId,
      kind: "record_supplier_payment",
      result,
    });
    return result;
  },
});
