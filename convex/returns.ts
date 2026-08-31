import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { requireRole, assertBranchAccess, resolveBranchFilter, canViewCostPrice } from "./shared/permissions";
import {
  assertPositiveQuantity,
  roundMoney,
  sanitizeText,
  sanitizeOptionalText,
  TEXT_LIMITS,
} from "./shared/validation";
import { writeAuditLog } from "./shared/audit";
import { Id } from "./_generated/dataModel";
import { applyBranchStockChange } from "./shared/branchStock";
import { increaseLot, productTracksExpiry } from "./shared/lots";
import {
  lineRefundAmount,
  loadReturnedLotQty,
  loadReturnableLines,
  nextReturnNumber,
} from "./shared/returns";
import { loadPrintSnapshot } from "./settings";

type DbCtx = QueryCtx | MutationCtx;

async function requireReturnableSale(ctx: DbCtx, saleId: Id<"sales">) {
  const { userId, profile, organizationId } = await requireRole(ctx, [
    "administrator",
    "manager",
    "cashier",
  ]);
  const sale = await ctx.db.get(saleId);
  if (!sale) throw new Error("Order not found");
  if (sale.status !== "completed") throw new Error("Only completed orders can be returned");
  if (!sale.branchId) throw new Error("Order is missing a branch");
  if (sale.organizationId !== organizationId) throw new Error("Not found");
  assertBranchAccess(profile, sale.branchId);
  if (profile.role === "cashier" && sale.cashierId !== userId) {
    throw new Error("Forbidden");
  }
  return { userId, profile, organizationId, sale, branchId: sale.branchId };
}

export const preview = query({
  args: { saleId: v.id("sales") },
  handler: async (ctx, args) => {
    const { sale, profile } = await requireReturnableSale(ctx, args.saleId);
    const { items, refundedAmount, returns } = await loadReturnableLines(ctx, sale._id);
    const remainingRefundable = roundMoney(Math.max(0, sale.total - refundedAmount));
    const showCost = canViewCostPrice(profile);
    return {
      saleId: sale._id,
      invoiceNumber: sale.invoiceNumber,
      paymentMethod: sale.paymentMethod,
      saleTotal: sale.total,
      saleSubtotal: sale.subtotal,
      saleDiscount: sale.discount,
      refundedAmount,
      remainingRefundable,
      canReturn: items.some((item) => item.remainingQuantity > 0),
      items: items.map((item) =>
        showCost ? item : { ...item, unitCost: undefined },
      ),
      returns: returns.map((row) => ({
        id: row._id,
        returnNumber: row.returnNumber,
        refundAmount: row.refundAmount,
        reason: row.reason,
        completedAt: row.completedAt,
        itemCount: row.itemCount,
      })),
    };
  },
});

export const processReturn = mutation({
  args: {
    saleId: v.id("sales"),
    items: v.array(
      v.object({
        saleItemId: v.id("saleItems"),
        quantity: v.number(),
      }),
    ),
    reason: v.string(),
    notes: v.optional(v.string()),
    clientOperationId: v.optional(v.string()),
    /** Return number printed on the receipt. Convex persists this; it must not change on sync. */
    returnNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId, sale, branchId } = await requireReturnableSale(
      ctx,
      args.saleId,
    );
    const reason = sanitizeText(args.reason, "Return reason", TEXT_LIMITS.short);
    const notes = sanitizeOptionalText(args.notes, "Notes", TEXT_LIMITS.note);

    if (args.clientOperationId?.trim()) {
      const existing = await ctx.db
        .query("saleReturnClientOps")
        .withIndex("by_organization_clientOperationId", (q) =>
          q
            .eq("organizationId", organizationId)
            .eq("clientOperationId", args.clientOperationId!.trim()),
        )
        .unique();
      if (existing) {
        const prior = await ctx.db.get(existing.returnId);
        if (!prior || prior.organizationId !== organizationId) {
          throw new Error("This return was already submitted and cannot be created again");
        }
        return {
          returnId: prior._id,
          returnNumber: prior.returnNumber,
          refundAmount: prior.refundAmount,
          receiptPayload: JSON.parse(prior.payload) as unknown,
        };
      }
    }

    const requested = args.items.filter((item) => item.quantity > 0);
    if (requested.length === 0) throw new Error("Select at least one item to return");

    const { items: returnable, refundedAmount } = await loadReturnableLines(ctx, sale._id);
    const byId = new Map(returnable.map((item) => [item.saleItemId, item]));
    const remainingQty = returnable.reduce((sum, item) => sum + item.remainingQuantity, 0);
    let returningQty = 0;
    let computedRefund = 0;
    const lines: Array<{
      saleItem: (typeof returnable)[number];
      quantity: number;
      lineRefund: number;
    }> = [];

    for (const item of requested) {
      assertPositiveQuantity(item.quantity);
      const saleItem = byId.get(item.saleItemId);
      if (!saleItem || saleItem.saleItemId !== item.saleItemId) {
        throw new Error("Return item is not part of this order");
      }
      if (item.quantity > saleItem.remainingQuantity) {
        throw new Error(`Cannot return more than remaining quantity for ${saleItem.productName}`);
      }
      const lineRefund = lineRefundAmount({
        returningQty: item.quantity,
        soldQty: saleItem.quantity,
        lineTotal: saleItem.lineTotal,
        saleSubtotal: sale.subtotal,
        saleCartDiscount: sale.discount,
      });
      returningQty += item.quantity;
      computedRefund += lineRefund;
      lines.push({ saleItem, quantity: item.quantity, lineRefund });
    }

    const remainingRefundable = roundMoney(Math.max(0, sale.total - refundedAmount));
    let refundAmount = roundMoney(computedRefund);
    if (returningQty >= remainingQty) {
      refundAmount = remainingRefundable;
    } else if (refundAmount > remainingRefundable) {
      refundAmount = remainingRefundable;
    }
    if (refundAmount < 0) {
      throw new Error("Invalid refund amount");
    }

    const returnNumber = await nextReturnNumber(ctx, organizationId, args.returnNumber);
    const completedAt = Date.now();
    const snapshot = await loadPrintSnapshot(ctx, organizationId, branchId);

    const kind = returningQty >= remainingQty ? "full" : "partial";
    const returnId = await ctx.db.insert("saleReturns", {
      organizationId,
      returnNumber,
      saleId: sale._id,
      branchId,
      customerId: sale.customerId,
      customerName: sale.customerName,
      processedBy: userId,
      reason,
      notes,
      refundAmount,
      refundMethod: sale.paymentMethod,
      itemCount: returningQty,
      kind,
      status: "completed",
      payload: "{}",
      completedAt,
    });

    const receiptLines: Array<{
      productName: string;
      sku?: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      lineTotal: number;
    }> = [];

    for (const line of lines) {
      const product = await ctx.db.get(line.saleItem.productId);
      const returnItemId = await ctx.db.insert("saleReturnItems", {
        organizationId,
        returnId,
        saleItemId: line.saleItem.saleItemId,
        productId: line.saleItem.productId,
        productName: line.saleItem.productName,
        quantity: line.quantity,
        unitPrice: line.saleItem.unitPrice,
        unitCost: line.saleItem.unitCost,
        lineRefund: line.lineRefund,
      });
      receiptLines.push({
        productName: line.saleItem.productName,
        sku: product?.sku,
        quantity: line.quantity,
        unitPrice: line.saleItem.unitPrice,
        discount: 0,
        lineTotal: line.lineRefund,
      });

      const restockNote = `Return ${returnNumber} for ${sale.invoiceNumber}`;
      if (product && productTracksExpiry(product)) {
        const allocations = await ctx.db
          .query("saleItemLots")
          .withIndex("by_saleItem", (q) => q.eq("saleItemId", line.saleItem.saleItemId))
          .collect();
        const alreadyReturned = await loadReturnedLotQty(ctx, line.saleItem.saleItemId);
        // This return's lots are not recorded yet; subtract current line so we restore remaining original lots.
        let remainingToRestore = line.quantity;
        const ordered = [...allocations].reverse();
        for (const allocation of ordered) {
          if (remainingToRestore <= 0) break;
          const already = alreadyReturned.get(allocation.lotId) ?? 0;
          const available = Math.max(0, allocation.quantity - already);
          if (available <= 0) continue;
          const take = Math.min(available, remainingToRestore);
          const lotId = await increaseLot(ctx, {
            branchId,
            productId: line.saleItem.productId,
            quantity: take,
            expiryDate: allocation.expiryDate,
            reason: "return",
            performedBy: userId,
            note: restockNote,
            relatedSaleId: sale._id,
            relatedReturnId: returnId,
          });
          await ctx.db.insert("saleReturnItemLots", {
            organizationId,
            returnItemId,
            lotId,
            quantity: take,
            expiryDate: allocation.expiryDate,
          });
          remainingToRestore -= take;
        }
        if (remainingToRestore > 0) {
          const fallbackExpiry = ordered[0]?.expiryDate;
          if (!fallbackExpiry) {
            throw new Error(
              `Cannot restock dated product ${line.saleItem.productName} without lot history`,
            );
          }
          const lotId = await increaseLot(ctx, {
            branchId,
            productId: line.saleItem.productId,
            quantity: remainingToRestore,
            expiryDate: fallbackExpiry,
            reason: "return",
            performedBy: userId,
            note: restockNote,
            relatedSaleId: sale._id,
            relatedReturnId: returnId,
          });
          await ctx.db.insert("saleReturnItemLots", {
            organizationId,
            returnItemId,
            lotId,
            quantity: remainingToRestore,
            expiryDate: fallbackExpiry,
          });
        }
      } else {
        await applyBranchStockChange(ctx, {
          branchId,
          productId: line.saleItem.productId,
          quantityChange: line.quantity,
          reason: "return",
          performedBy: userId,
          note: restockNote,
          relatedSaleId: sale._id,
          relatedReturnId: returnId,
        });
      }
    }

    const payload = {
      kind: "return" as const,
      invoiceNumber: returnNumber,
      returnNumber,
      originalInvoiceNumber: sale.invoiceNumber,
      saleId: sale._id,
      returnId,
      branchId,
      subtotal: refundAmount,
      discount: 0,
      total: refundAmount,
      itemCount: returningQty,
      lines: receiptLines,
      paymentMethod: sale.paymentMethod,
      completedAt,
      customerName: sale.customerName,
      cashierName: profile.name,
      returnReason: reason,
      business: snapshot.business,
      template: snapshot.template,
    };

    await ctx.db.patch(returnId, { payload: JSON.stringify(payload) });

    if (args.clientOperationId?.trim()) {
      await ctx.db.insert("saleReturnClientOps", {
        organizationId,
        clientOperationId: args.clientOperationId.trim(),
        returnId,
        processedBy: userId,
        createdAt: completedAt,
      });
    }

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "process_return",
      entityType: "saleReturns",
      entityId: returnId,
      metadata: {
        saleId: sale._id,
        invoiceNumber: sale.invoiceNumber,
        returnNumber,
        refundAmount,
        itemCount: returningQty,
      },
    });

    return {
      returnId,
      returnNumber,
      refundAmount,
      receiptPayload: payload,
    };
  },
});

function returnKind(
  kind: "full" | "partial" | undefined,
  itemCount: number,
  saleItemCount: number,
): "full" | "partial" {
  if (kind === "full" || kind === "partial") return kind;
  return itemCount >= saleItemCount ? "full" : "partial";
}

export const list = query({
  args: {
    search: v.optional(v.string()),
    branchId: v.optional(v.id("branches")),
    kind: v.optional(v.union(v.literal("full"), v.literal("partial"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);
    const limit = Math.min(args.limit ?? 100, 200);
    let rows = await ctx.db
      .query("saleReturns")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    if (branchFilter) {
      rows = rows.filter((row) => row.branchId === branchFilter);
    }
    if (profile.role === "cashier") {
      const mySales = (
        await ctx.db
          .query("sales")
          .withIndex("by_cashier", (q) => q.eq("cashierId", userId))
          .collect()
      )
        .filter((s) => s.organizationId === organizationId)
        .map((s) => s._id);
      const mine = new Set(mySales);
      rows = rows.filter((row) => mine.has(row.saleId) || row.processedBy === userId);
    }

    const sales = await Promise.all(rows.map((row) => ctx.db.get(row.saleId)));
    const saleById = new Map(sales.filter(Boolean).map((s) => [s!._id, s!] as const));
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const nameByUser = new Map(profiles.map((p) => [p.userId, p.name]));
    const branches = await ctx.db
      .query("branches")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const branchName = new Map(branches.map((b) => [b._id, b.name]));

    let mapped = rows.map((row) => {
      const sale = saleById.get(row.saleId);
      const kind = returnKind(row.kind, row.itemCount, sale?.itemCount ?? row.itemCount);
      return {
        id: row._id,
        returnNumber: row.returnNumber,
        saleId: row.saleId,
        invoiceNumber: sale?.invoiceNumber ?? "—",
        branchId: row.branchId,
        branchName: branchName.get(row.branchId) ?? null,
        customerName: row.customerName,
        cashierName: nameByUser.get(row.processedBy) ?? "Staff",
        refundAmount: row.refundAmount,
        itemCount: row.itemCount,
        reason: row.reason,
        kind,
        status: row.status,
        completedAt: row.completedAt,
      };
    });

    if (args.kind) {
      mapped = mapped.filter((row) => row.kind === args.kind);
    }
    if (args.search?.trim()) {
      const q = args.search.trim().toLowerCase();
      mapped = mapped.filter(
        (row) =>
          row.returnNumber.toLowerCase().includes(q) ||
          row.invoiceNumber.toLowerCase().includes(q) ||
          row.customerName.toLowerCase().includes(q) ||
          row.reason.toLowerCase().includes(q),
      );
    }

    return mapped.sort((a, b) => b.completedAt - a.completedAt).slice(0, limit);
  },
});

export const get = query({
  args: { id: v.id("saleReturns") },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    if (row.organizationId !== organizationId) throw new Error("Not found");
    assertBranchAccess(profile, row.branchId);
    const sale = await ctx.db.get(row.saleId);
    if (
      profile.role === "cashier" &&
      sale &&
      sale.cashierId !== userId &&
      row.processedBy !== userId
    ) {
      throw new Error("Forbidden");
    }
    const items = await ctx.db
      .query("saleReturnItems")
      .withIndex("by_return", (q) => q.eq("returnId", row._id))
      .collect();
    const processor = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", row.processedBy))
      .unique();
    const branch = await ctx.db.get(row.branchId);
    let receiptPayload: unknown = null;
    try {
      receiptPayload = JSON.parse(row.payload);
    } catch {
      receiptPayload = null;
    }
    return {
      id: row._id,
      returnNumber: row.returnNumber,
      saleId: row.saleId,
      invoiceNumber: sale?.invoiceNumber ?? "—",
      branchId: row.branchId,
      branchName: branch?.name ?? null,
      customerName: row.customerName,
      cashierName: processor?.name ?? "Staff",
      refundAmount: row.refundAmount,
      refundMethod: row.refundMethod,
      itemCount: row.itemCount,
      reason: row.reason,
      notes: row.notes ?? null,
      kind: returnKind(row.kind, row.itemCount, sale?.itemCount ?? row.itemCount),
      status: row.status,
      completedAt: row.completedAt,
      items: items.map((item) => ({
        id: item._id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineRefund: item.lineRefund,
      })),
      receiptPayload,
    };
  },
});
