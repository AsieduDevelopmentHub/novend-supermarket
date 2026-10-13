import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireRole, resolveBranchFilter } from "./shared/permissions";
import { applyBranchStockChange } from "./shared/branchStock";
import { increaseLot, productTracksExpiry } from "./shared/lots";
import { writeAuditLog } from "./shared/audit";
import { rememberClientOp, replayClientOp } from "./shared/clientOps";
import { settlementMethodValidator } from "./shared/paymentMethod";
import { purchaseBalance } from "./shared/supplierFinance";
import { assertOrganizationFeature } from "./shared/entitlements";
import { allocatePurchaseReference } from "./shared/documentReferences";
import {
  productMatchesLookup,
  assertPositiveMoney,
  roundMoney,
  sanitizeOptionalText,
  TEXT_LIMITS,
} from "./shared/validation";

async function getWholesaleRow(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  productId: Id<"products">,
) {
  const existing = await ctx.db
    .query("wholesaleStock")
    .withIndex("by_organization_product", (q) =>
      q.eq("organizationId", organizationId).eq("productId", productId),
    )
    .unique();
  if (existing) return existing;
  const id = await ctx.db.insert("wholesaleStock", {
    organizationId,
    productId,
    quantity: 0,
  });
  return (await ctx.db.get(id))!;
}

async function changeWholesale(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    productId: Id<"products">;
    quantityChange: number;
    reason: "wholesale_receive" | "wholesale_issue";
    performedBy: Id<"users">;
    note?: string;
    relatedTransferId?: Id<"stockTransfers">;
  },
) {
  const row = await getWholesaleRow(ctx, args.organizationId, args.productId);
  const next = row.quantity + args.quantityChange;
  if (next < 0) throw new Error("Insufficient wholesale stock");
  await ctx.db.patch(row._id, { quantity: next });
  await ctx.db.insert("inventoryHistory", {
    organizationId: args.organizationId,
    productId: args.productId,
    quantityChange: args.quantityChange,
    quantityAfter: next,
    reason: args.reason,
    note: args.note,
    performedBy: args.performedBy,
    relatedTransferId: args.relatedTransferId,
  });
  return next;
}

async function addWholesaleLot(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    productId: Id<"products">;
    quantity: number;
    expiryDate: string;
    purchaseId?: Id<"supplierPurchases">;
  },
) {
  const existing = await ctx.db
    .query("wholesaleLots")
    .withIndex("by_organization_product", (q) =>
      q.eq("organizationId", args.organizationId).eq("productId", args.productId),
    )
    .collect();
  const match = existing.find((lot) => lot.expiryDate === args.expiryDate && lot.quantity > 0);
  if (match) {
    await ctx.db.patch(match._id, { quantity: match.quantity + args.quantity });
    return;
  }
  await ctx.db.insert("wholesaleLots", {
    organizationId: args.organizationId,
    productId: args.productId,
    quantity: args.quantity,
    expiryDate: args.expiryDate,
    receivedAt: Date.now(),
    purchaseId: args.purchaseId,
  });
}

async function takeWholesaleLots(
  ctx: MutationCtx,
  args: { organizationId: Id<"organizations">; productId: Id<"products">; quantity: number },
) {
  const lots = (
    await ctx.db
      .query("wholesaleLots")
      .withIndex("by_organization_product", (q) =>
        q.eq("organizationId", args.organizationId).eq("productId", args.productId),
      )
      .collect()
  )
    .filter((lot) => lot.quantity > 0)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  let remaining = args.quantity;
  const taken: Array<{ quantity: number; expiryDate: string }> = [];
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.quantity, remaining);
    await ctx.db.patch(lot._id, { quantity: lot.quantity - take });
    taken.push({ quantity: take, expiryDate: lot.expiryDate });
    remaining -= take;
  }
  if (remaining > 0) {
    throw new Error("Insufficient dated wholesale stock");
  }
  return taken;
}

export const listStock = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const rows = await ctx.db
      .query("wholesaleStock")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const products = await ctx.db
      .query("products")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const productMap = new Map(products.map((p) => [p._id, p]));
    let mapped = rows.map((row) => {
      const product = productMap.get(row.productId);
      return {
        id: row._id,
        productId: row.productId,
        name: product?.name ?? "Unknown",
        sku: product?.sku ?? "",
        barcode: product?.barcode,
        unit: product?.unit ?? "",
        costPrice: product?.costPrice ?? 0,
        sellingPrice: product?.sellingPrice ?? 0,
        quantity: row.quantity,
        value: row.quantity * (product?.costPrice ?? 0),
        tracksExpiry: product?.tracksExpiry ?? false,
      };
    });
    if (args.search?.trim()) {
      mapped = mapped.filter((row) =>
        productMatchesLookup({ name: row.name, sku: row.sku, barcode: row.barcode }, args.search!),
      );
    }
    return mapped.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const rows = await ctx.db
      .query("wholesaleStock")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const products = await ctx.db
      .query("products")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const cost = new Map(products.map((p) => [p._id, p.costPrice]));
    const units = rows.reduce((sum, row) => sum + row.quantity, 0);
    const value = rows.reduce((sum, row) => sum + row.quantity * (cost.get(row.productId) ?? 0), 0);
    const skuCount = rows.filter((row) => row.quantity > 0).length;
    return { units, value, skuCount };
  },
});

export const listPurchases = query({
  args: { supplierId: v.optional(v.id("suppliers")), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    let rows = await ctx.db
      .query("supplierPurchases")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    if (args.supplierId) {
      rows = rows.filter((row) => row.supplierId === args.supplierId);
    }
    const suppliers = await ctx.db
      .query("suppliers")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const names = new Map(suppliers.map((s) => [s._id, s.name]));
    const limit = Math.min(args.limit ?? 80, 200);
    const sliced = rows.sort((a, b) => b.purchasedAt - a.purchasedAt).slice(0, limit);
    const itemGroups = await Promise.all(
      sliced.map((row) =>
        ctx.db
          .query("supplierPurchaseItems")
          .withIndex("by_purchase", (q) => q.eq("purchaseId", row._id))
          .collect(),
      ),
    );
    return sliced.map((row, index) => ({
      id: row._id,
      reference: row.reference,
      invoiceNumber: row.invoiceNumber ?? null,
      supplierId: row.supplierId,
      supplierName: names.get(row.supplierId) ?? "Supplier",
      purchasedAt: row.purchasedAt,
      itemCount: row.itemCount,
      totalCost: row.totalCost,
      amountPaid: row.amountPaid ?? null,
      balance: purchaseBalance(row),
      notes: row.notes ?? null,
      status: row.status,
      items: (itemGroups[index] ?? []).map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitCost: item.unitCost,
        unitSellingPrice: item.unitSellingPrice ?? null,
        lineTotal: item.lineTotal,
      })),
    }));
  },
});

export const recordPurchase = mutation({
  args: {
    supplierId: v.id("suppliers"),
    invoiceNumber: v.optional(v.string()),
    purchasedAt: v.number(),
    /** Omit to record the delivery as paid in full. Send 0 when the supplier is still owed. */
    amountPaid: v.optional(v.number()),
    paymentMethod: v.optional(settlementMethodValidator),
    notes: v.optional(v.string()),
    clientOperationId: v.optional(v.string()),
    items: v.array(
      v.object({
        productId: v.id("products"),
        quantity: v.number(),
        unitCost: v.number(),
        sellingPrice: v.optional(v.number()),
        expiryDate: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId, organization } = await requireRole(ctx, [
      "administrator",
      "manager",
    ]);
    await assertOrganizationFeature(ctx, organization, "inventory.wholesale");
    const replayed = await replayClientOp<{
      purchaseId: Id<"supplierPurchases">;
      reference: string;
    }>(ctx, organizationId, args.clientOperationId);
    if (replayed) return replayed;
    const supplier = await ctx.db.get(args.supplierId);
    if (!supplier || supplier.organizationId !== organizationId || supplier.status !== "active") {
      throw new Error("Select a valid supplier");
    }
    if (args.items.length === 0) throw new Error("Add at least one product");

    let totalCost = 0;
    let itemCount = 0;
    const prepared: Array<{
      product: Doc<"products">;
      quantity: number;
      unitCost: number;
      sellingPrice: number;
      lineTotal: number;
      expiryDate?: string;
    }> = [];

    for (const item of args.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error("Quantity must be a positive integer");
      }
      assertPositiveMoney(item.unitCost, "unit cost");
      if (item.sellingPrice !== undefined) {
        assertPositiveMoney(item.sellingPrice, "selling price");
      }
      const product = await ctx.db.get(item.productId);
      if (!product || product.organizationId !== organizationId || product.status === "archived") {
        throw new Error("Invalid product in purchase");
      }
      if (productTracksExpiry(product) && !item.expiryDate) {
        throw new Error(`${product.name} requires an expiry date`);
      }
      const unitCost = roundMoney(item.unitCost);
      const sellingPrice = roundMoney(item.sellingPrice ?? product.sellingPrice);
      const lineTotal = roundMoney(unitCost * item.quantity);
      totalCost += lineTotal;
      itemCount += item.quantity;
      prepared.push({
        product,
        quantity: item.quantity,
        unitCost,
        sellingPrice,
        lineTotal,
        expiryDate: item.expiryDate,
      });
    }

    let reference: string | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const candidate = allocatePurchaseReference();
      const existing = await ctx.db
        .query("supplierPurchases")
        .withIndex("by_organization_reference", (q) =>
          q.eq("organizationId", organizationId).eq("reference", candidate),
        )
        .unique();
      if (!existing) {
        reference = candidate;
        break;
      }
    }
    if (!reference) throw new Error("Could not allocate a unique purchase reference");
    const total = roundMoney(totalCost);
    let amountPaid = total;
    if (args.amountPaid !== undefined) {
      assertPositiveMoney(args.amountPaid, "amount paid");
      amountPaid = roundMoney(args.amountPaid);
      if (amountPaid - total > 0.001) {
        throw new Error("Amount paid cannot exceed the purchase total");
      }
    }
    const purchaseId = await ctx.db.insert("supplierPurchases", {
      organizationId,
      supplierId: args.supplierId,
      reference,
      invoiceNumber: sanitizeOptionalText(args.invoiceNumber, "Invoice", TEXT_LIMITS.code),
      purchasedAt: args.purchasedAt,
      notes: sanitizeOptionalText(args.notes, "Notes", TEXT_LIMITS.note),
      itemCount,
      totalCost: roundMoney(totalCost),
      status: "completed",
      amountPaid,
      createdBy: userId,
      createdAt: Date.now(),
    });

    if (amountPaid > 0) {
      await ctx.db.insert("supplierPayments", {
        organizationId,
        supplierId: args.supplierId,
        purchaseId,
        amount: amountPaid,
        paidAt: args.purchasedAt,
        method: args.paymentMethod ?? "cash",
        note: "Paid when the delivery was recorded",
        recordedBy: userId,
        createdAt: Date.now(),
      });
    }

    for (const item of prepared) {
      await ctx.db.insert("supplierPurchaseItems", {
        organizationId,
        purchaseId,
        productId: item.product._id,
        productName: item.product.name,
        quantity: item.quantity,
        unitCost: item.unitCost,
        lineTotal: item.lineTotal,
        unitSellingPrice: item.sellingPrice,
        expiryDate: item.expiryDate,
      });
      const costChanged = item.unitCost !== item.product.costPrice;
      const sellingChanged = item.sellingPrice !== item.product.sellingPrice;
      if (costChanged || sellingChanged) {
        await ctx.db.patch(item.product._id, {
          costPrice: item.unitCost,
          sellingPrice: item.sellingPrice,
        });
      }
      await changeWholesale(ctx, {
        organizationId,
        productId: item.product._id,
        quantityChange: item.quantity,
        reason: "wholesale_receive",
        performedBy: userId,
        note: `Purchase ${reference}`,
      });
      if (productTracksExpiry(item.product) && item.expiryDate) {
        await addWholesaleLot(ctx, {
          organizationId,
          productId: item.product._id,
          quantity: item.quantity,
          expiryDate: item.expiryDate,
          purchaseId,
        });
      }
    }

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "wholesale_purchase",
      entityType: "supplierPurchases",
      entityId: purchaseId,
      organizationId,
      metadata: {
        supplierId: args.supplierId,
        reference,
        totalCost,
        priceUpdates: prepared
          .filter(
            (item) =>
              item.unitCost !== item.product.costPrice ||
              item.sellingPrice !== item.product.sellingPrice,
          )
          .map((item) => ({
            productId: item.product._id,
            costPrice: item.unitCost,
            sellingPrice: item.sellingPrice,
          })),
      },
    });
    const result = { purchaseId, reference };
    await rememberClientOp(ctx, {
      organizationId,
      clientOperationId: args.clientOperationId,
      kind: "record_wholesale_purchase",
      result,
    });
    return result;
  },
});

export const transferToBranch = mutation({
  args: {
    branchId: v.id("branches"),
    productId: v.id("products"),
    quantity: v.number(),
    note: v.optional(v.string()),
    clientOperationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId, organization } = await requireRole(ctx, [
      "administrator",
      "manager",
    ]);
    await assertOrganizationFeature(ctx, organization, "inventory.wholesale");
    const replayed = await replayClientOp<Id<"stockTransfers">>(
      ctx,
      organizationId,
      args.clientOperationId,
    );
    if (replayed) return replayed;
    if (!Number.isInteger(args.quantity) || args.quantity <= 0) {
      throw new Error("Quantity must be a positive integer");
    }
    const branch = await ctx.db.get(args.branchId);
    if (!branch || branch.organizationId !== organizationId || branch.status !== "active") {
      throw new Error("Invalid destination branch");
    }
    if (profile.role === "manager" && profile.branchId !== args.branchId) {
      throw new Error("Managers can only restock their own branch");
    }
    const product = await ctx.db.get(args.productId);
    if (!product || product.organizationId !== organizationId) {
      throw new Error("Product not found");
    }

    const note =
      sanitizeOptionalText(args.note, "Note", TEXT_LIMITS.note) ?? `Issued to ${branch.name}`;
    const transferId = await ctx.db.insert("stockTransfers", {
      organizationId,
      kind: "wholesale",
      toBranchId: args.branchId,
      productId: args.productId,
      quantity: args.quantity,
      note,
      performedBy: userId,
      createdAt: Date.now(),
    });

    await changeWholesale(ctx, {
      organizationId,
      productId: args.productId,
      quantityChange: -args.quantity,
      reason: "wholesale_issue",
      performedBy: userId,
      note,
      relatedTransferId: transferId,
    });

    if (productTracksExpiry(product)) {
      const lots = await takeWholesaleLots(ctx, {
        organizationId,
        productId: args.productId,
        quantity: args.quantity,
      });
      for (const lot of lots) {
        await increaseLot(ctx, {
          branchId: args.branchId,
          productId: args.productId,
          quantity: lot.quantity,
          expiryDate: lot.expiryDate,
          reason: "transfer_in",
          performedBy: userId,
          note,
          relatedTransferId: transferId,
        });
      }
    } else {
      await applyBranchStockChange(ctx, {
        branchId: args.branchId,
        productId: args.productId,
        quantityChange: args.quantity,
        reason: "transfer_in",
        performedBy: userId,
        note,
        relatedTransferId: transferId,
      });
    }

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "wholesale_transfer",
      entityType: "stockTransfers",
      entityId: transferId,
      organizationId,
      metadata: { branchId: args.branchId, productId: args.productId, quantity: args.quantity },
    });
    await rememberClientOp(ctx, {
      organizationId,
      clientOperationId: args.clientOperationId,
      kind: "wholesale_transfer",
      result: transferId,
    });
    return transferId;
  },
});

export const listTransfers = query({
  args: { branchId: v.optional(v.id("branches")) },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);
    const rows = await ctx.db
      .query("stockTransfers")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const products = await ctx.db
      .query("products")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const branches = await ctx.db
      .query("branches")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const productName = new Map(products.map((p) => [p._id, p.name]));
    const branchName = new Map(branches.map((b) => [b._id, b.name]));
    return rows
      .filter((row) => {
        if ((row.kind ?? "branch") !== "wholesale") return false;
        if (branchFilter && row.toBranchId !== branchFilter) return false;
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 80)
      .map((row) => ({
        id: row._id,
        productName: productName.get(row.productId) ?? "Product",
        branchName: branchName.get(row.toBranchId) ?? "Branch",
        quantity: row.quantity,
        note: row.note ?? null,
        createdAt: row.createdAt,
      }));
  },
});
