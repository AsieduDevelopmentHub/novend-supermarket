import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  assertBranchAccess,
  isAdmin,
  requireBranchId,
  requireRole,
  resolveBranchFilter,
} from "./shared/permissions";
import {
  applyBranchStockChange,
  getBranchQuantity,
  stockMapForBranch,
  stockMapOrgWide,
} from "./shared/branchStock";
import {
  applyInventoryMovement,
  decreaseLots,
  deriveExpiryListFields,
  increaseLot,
  listLotsForProductBranch,
  lotStatus,
  lotSummaries,
  productExpiryAlertDays,
  productTracksExpiry,
  relabelLotExpiry,
  todayDateString,
  writeOffExpiredLots,
} from "./shared/lots";
import { writeAuditLog } from "./shared/audit";
import { rememberClientOp, replayClientOp } from "./shared/clientOps";
import { sanitizeOptionalText, productMatchesLookup, TEXT_LIMITS } from "./shared/validation";

export const list = query({
  args: {
    search: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    // Admin with no branchId → org-wide totals; others forced to own branch.
    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const categoryMap = new Map(categories.map((c) => [c._id, c.name]));
    const stockByProduct = branchFilter
      ? await stockMapForBranch(ctx, branchFilter)
      : await stockMapOrgWide(ctx, organizationId);
    const productsForAlerts = (
      await ctx.db
        .query("products")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect()
    ).filter((p) => p.status === "active" || p.status === "inactive");
    const alertDaysByProduct = new Map(
      productsForAlerts.map((p) => [String(p._id), productExpiryAlertDays(p)]),
    );
    const summaries = await lotSummaries(ctx, branchFilter, organizationId, alertDaysByProduct);

    let products = productsForAlerts;

    if (args.categoryId) {
      products = products.filter((p) => p.categoryId === args.categoryId);
    }
    if (args.search?.trim()) {
      products = products.filter((p) =>
        productMatchesLookup({ name: p.name, sku: p.sku, barcode: p.barcode }, args.search!),
      );
    }

    return await Promise.all(
      products
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(async (product) => {
          const imageUrl = product.imageStorageId
            ? await ctx.storage.getUrl(product.imageStorageId)
            : null;
          const stockQuantity = stockByProduct.get(product._id) ?? 0;
          const expiry = deriveExpiryListFields(product, stockQuantity, summaries.get(product._id));
          return {
            id: product._id,
            name: product.name,
            sku: product.sku,
            barcode: product.barcode,
            categoryId: product.categoryId,
            categoryName: categoryMap.get(product.categoryId) ?? "Uncategorized",
            stockQuantity,
            unit: product.unit,
            lowStockThreshold: product.lowStockThreshold,
            statusLabel: expiry.statusLabel,
            isLowStock: expiry.isLowStock,
            imageUrl,
            branchId: branchFilter,
            tracksExpiry: expiry.tracksExpiry,
            sellableQuantity: expiry.sellableQuantity,
            expiredQuantity: expiry.expiredQuantity,
            nearestExpiry: expiry.nearestExpiry,
            nearestSellableExpiry: expiry.nearestSellableExpiry,
            isExpired: expiry.isExpired,
            isExpiring: expiry.isExpiring,
          };
        }),
    );
  },
});

export const adjustStock = mutation({
  args: {
    productId: v.id("products"),
    branchId: v.optional(v.id("branches")),
    quantityChange: v.number(),
    reason: v.union(
      v.literal("receive"),
      v.literal("adjustment"),
      v.literal("damage"),
      v.literal("return"),
    ),
    note: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    lotId: v.optional(v.id("inventoryLots")),
    lotCode: v.optional(v.string()),
    clientOperationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
    ]);
    const replayed = await replayClientOp<number>(ctx, organizationId, args.clientOperationId);
    if (replayed !== null) return replayed;
    const product = await ctx.db.get(args.productId);
    if (!product || product.organizationId !== organizationId) throw new Error("Product not found");
    if (!Number.isInteger(args.quantityChange) || args.quantityChange === 0) {
      throw new Error("Quantity change must be a non-zero integer");
    }

    const branchId = args.branchId ?? profile.branchId ?? (await requireBranchId(ctx)).branchId;
    assertBranchAccess(profile, branchId);

    await applyInventoryMovement(ctx, {
      product,
      branchId,
      quantityChange: args.quantityChange,
      reason: args.reason,
      expiryDate: args.expiryDate,
      lotId: args.lotId,
      lotCode: args.lotCode,
      note: sanitizeOptionalText(args.note, "Note", TEXT_LIMITS.note),
      performedBy: userId,
    });

    const next = await getBranchQuantity(ctx, branchId, args.productId);

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "adjust_inventory",
      entityType: "products",
      entityId: args.productId,
      metadata: {
        quantityChange: args.quantityChange,
        reason: args.reason,
        branchId,
        expiryDate: args.expiryDate,
      },
    });

    await rememberClientOp(ctx, {
      organizationId,
      clientOperationId: args.clientOperationId,
      kind: "adjust_stock",
      result: next,
    });
    return next;
  },
});

export const transferStock = mutation({
  args: {
    fromBranchId: v.id("branches"),
    toBranchId: v.id("branches"),
    productId: v.id("products"),
    quantity: v.number(),
    note: v.optional(v.string()),
    clientOperationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
    ]);
    const replayed = await replayClientOp<Id<"stockTransfers">>(
      ctx,
      organizationId,
      args.clientOperationId,
    );
    if (replayed) return replayed;
    if (args.fromBranchId === args.toBranchId) {
      throw new Error("Choose two different branches");
    }
    if (!Number.isInteger(args.quantity) || args.quantity <= 0) {
      throw new Error("Quantity must be a positive integer");
    }

    const from = await ctx.db.get(args.fromBranchId);
    const to = await ctx.db.get(args.toBranchId);
    if (!from || from.status !== "active" || from.organizationId !== organizationId) {
      throw new Error("Source branch unavailable");
    }
    if (!to || to.status !== "active" || to.organizationId !== organizationId) {
      throw new Error("Destination branch unavailable");
    }
    const product = await ctx.db.get(args.productId);
    if (!product || product.status === "archived" || product.organizationId !== organizationId) {
      throw new Error("Product unavailable");
    }

    if (!isAdmin(profile)) {
      // Managers may only transfer out of their own branch.
      if (profile.branchId !== args.fromBranchId) {
        throw new Error("Managers can only transfer stock from their own branch");
      }
    }

    const dated = productTracksExpiry(product);
    if (!dated) {
      const available = await getBranchQuantity(ctx, args.fromBranchId, args.productId);
      if (available < args.quantity) {
        throw new Error("Insufficient stock at source branch");
      }
    }

    const note = sanitizeOptionalText(args.note, "Note", TEXT_LIMITS.note) ?? undefined;

    const transferId = await ctx.db.insert("stockTransfers", {
      organizationId: profile.organizationId,
      fromBranchId: args.fromBranchId,
      toBranchId: args.toBranchId,
      productId: args.productId,
      quantity: args.quantity,
      note,
      performedBy: userId,
      createdAt: Date.now(),
    });

    if (dated) {
      const allocations = await decreaseLots(ctx, {
        branchId: args.fromBranchId,
        productId: args.productId,
        quantity: args.quantity,
        reason: "transfer_out",
        sellableOnly: true,
        productName: product.name,
        performedBy: userId,
        note: note || `Transfer to ${to.name}`,
        relatedTransferId: transferId,
      });
      for (const allocation of allocations) {
        await increaseLot(ctx, {
          branchId: args.toBranchId,
          productId: args.productId,
          quantity: allocation.quantity,
          expiryDate: allocation.expiryDate,
          reason: "transfer_in",
          performedBy: userId,
          note: note || `Transfer from ${from.name}`,
          relatedTransferId: transferId,
        });
      }
    } else {
      await applyBranchStockChange(ctx, {
        branchId: args.fromBranchId,
        productId: args.productId,
        quantityChange: -args.quantity,
        reason: "transfer_out",
        note: note || `Transfer to ${to.name}`,
        performedBy: userId,
        relatedTransferId: transferId,
      });
      await applyBranchStockChange(ctx, {
        branchId: args.toBranchId,
        productId: args.productId,
        quantityChange: args.quantity,
        reason: "transfer_in",
        note: note || `Transfer from ${from.name}`,
        performedBy: userId,
        relatedTransferId: transferId,
      });
    }

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "transfer_stock",
      entityType: "stockTransfers",
      entityId: transferId,
      metadata: {
        fromBranchId: args.fromBranchId,
        toBranchId: args.toBranchId,
        productId: args.productId,
        quantity: args.quantity,
      },
    });

    await rememberClientOp(ctx, {
      organizationId,
      clientOperationId: args.clientOperationId,
      kind: "transfer_stock",
      result: transferId,
    });

    await ctx.scheduler.runAfter(0, internal.pushDispatch.dispatchPush, {
      organizationId,
      topic: "branch_transfers",
      title: "Stock transfer complete",
      body: `${product.name}: ${args.quantity} moved from ${from.name} to ${to.name}.`,
      data: { href: "/inventory", transferId: String(transferId) },
    });

    return transferId;
  },
});

export const listLots = query({
  args: {
    productId: v.id("products"),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);
    const product = await ctx.db.get(args.productId);
    if (!product || product.organizationId !== organizationId) return [];
    const alertDays = productExpiryAlertDays(product);
    const today = todayDateString();

    const lots = branchFilter
      ? await listLotsForProductBranch(ctx, branchFilter, args.productId)
      : (
          await ctx.db
            .query("inventoryLots")
            .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
            .collect()
        ).filter((lot) => lot.productId === args.productId);

    const branches = branchFilter
      ? []
      : await ctx.db
          .query("branches")
          .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
          .collect();
    const branchName = new Map(branches.map((b) => [b._id, b.name]));

    return lots
      .filter((lot) => lot.quantity > 0)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.receivedAt - b.receivedAt)
      .map((lot) => ({
        id: lot._id,
        branchId: lot.branchId,
        branchName: branchFilter ? null : (branchName.get(lot.branchId) ?? "Branch"),
        quantity: lot.quantity,
        expiryDate: lot.expiryDate,
        lotCode: lot.lotCode ?? lot.expiryDate,
        receivedAt: lot.receivedAt,
        status: lotStatus(lot.expiryDate, alertDays, today),
      }));
  },
});

export const updateLotExpiry = mutation({
  args: {
    lotId: v.id("inventoryLots"),
    expiryDate: v.string(),
    clientOperationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
    ]);
    const replayed = await replayClientOp<string>(ctx, organizationId, args.clientOperationId);
    if (replayed !== null) return replayed;

    const lot = await ctx.db.get(args.lotId);
    if (!lot || lot.organizationId !== organizationId) throw new Error("Lot not found");
    assertBranchAccess(profile, lot.branchId);
    const product = await ctx.db.get(lot.productId);
    if (!product || product.organizationId !== organizationId) throw new Error("Product not found");
    if (!productTracksExpiry(product)) {
      throw new Error("This product does not track expiry");
    }

    const nextId = await relabelLotExpiry(ctx, {
      lotId: args.lotId,
      expiryDate: args.expiryDate,
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "update_lot_expiry",
      entityType: "inventoryLots",
      entityId: nextId,
      metadata: { productId: lot.productId, from: lot.expiryDate, to: args.expiryDate },
    });

    await rememberClientOp(ctx, {
      organizationId,
      clientOperationId: args.clientOperationId,
      kind: "update_lot_expiry",
      result: nextId,
    });
    return nextId;
  },
});

export const writeOffExpired = mutation({
  args: {
    productId: v.id("products"),
    branchId: v.optional(v.id("branches")),
    lotId: v.optional(v.id("inventoryLots")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
    ]);
    const product = await ctx.db.get(args.productId);
    if (!product || product.organizationId !== organizationId) throw new Error("Product not found");
    if (!productTracksExpiry(product)) {
      throw new Error("This product does not track expiry");
    }

    let branchId = args.branchId ?? profile.branchId ?? null;
    if (args.lotId) {
      const lot = await ctx.db.get(args.lotId);
      if (!lot || lot.productId !== args.productId || lot.organizationId !== organizationId) {
        throw new Error("Lot not found for this product");
      }
      branchId = lot.branchId;
    } else if (!branchId) {
      branchId = (await requireBranchId(ctx)).branchId;
    }
    if (!branchId) throw new Error("Branch is required");
    assertBranchAccess(profile, branchId);

    const writtenOff = await writeOffExpiredLots(ctx, {
      branchId,
      productId: args.productId,
      lotId: args.lotId,
      performedBy: userId,
      note: sanitizeOptionalText(args.note, "Note", TEXT_LIMITS.note),
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "write_off_expired",
      entityType: "products",
      entityId: args.productId,
      metadata: { branchId, lotId: args.lotId, writtenOff },
    });

    return writtenOff;
  },
});

export const history = query({
  args: {
    productId: v.id("products"),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);
    const product = await ctx.db.get(args.productId);
    if (!product || product.organizationId !== organizationId) return [];

    let rows = await ctx.db
      .query("inventoryHistory")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();
    rows = rows.filter((r) => r.organizationId === organizationId);

    if (branchFilter) {
      rows = rows.filter((r) => r.branchId === branchFilter);
    }

    return rows.sort((a, b) => b._creationTime - a._creationTime).slice(0, 50);
  },
});

export const listTransfers = query({
  args: {
    branchId: v.optional(v.id("branches")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);
    const limit = Math.min(args.limit ?? 50, 100);

    let rows = await ctx.db
      .query("stockTransfers")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    if (branchFilter) {
      rows = rows.filter((r) => r.fromBranchId === branchFilter || r.toBranchId === branchFilter);
    }

    const branches = await ctx.db
      .query("branches")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const branchName = new Map(branches.map((b) => [b._id, b.name]));
    const products = await ctx.db
      .query("products")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const productName = new Map(products.map((p) => [p._id, p.name]));

    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map((r) => ({
        id: r._id,
        fromBranchId: r.fromBranchId,
        fromBranchName: r.fromBranchId ? (branchName.get(r.fromBranchId) ?? "Branch") : "Wholesale",
        toBranchId: r.toBranchId,
        toBranchName: branchName.get(r.toBranchId) ?? "Branch",
        productId: r.productId,
        productName: productName.get(r.productId) ?? "Product",
        quantity: r.quantity,
        note: r.note ?? null,
        createdAt: r.createdAt,
      }));
  },
});
