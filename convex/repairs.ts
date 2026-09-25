import { v } from "convex/values";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePlatformAdmin } from "./shared/permissions";
import { applyBranchStockChange } from "./shared/branchStock";
import { writeAuditLog } from "./shared/audit";
import { recomputeOrgPlatformStats } from "./shared/organizationStats";
import { incrementPlatformStats } from "./shared/platformStatsAggregate";

/**
 * One-off ops repair: Global Medicine (and similar) imports sometimes left
 * products with on-hand units but costPrice 0. Zero that stock only — never
 * touch products that already have a real cost.
 */
async function zeroZeroCostStockForOrg(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    dryRun: boolean;
    performedBy?: Id<"users">;
  },
) {
  const products = await ctx.db
    .query("products")
    .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
    .collect();

  const zeroCostProducts = products.filter((p) => p.costPrice === 0 && p.status !== "archived");
  const zeroCostIds = new Set(zeroCostProducts.map((p) => p._id));

  const branchRows = await ctx.db
    .query("branchStock")
    .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
    .collect();
  const branchTargets = branchRows.filter(
    (row) => zeroCostIds.has(row.productId) && row.quantity > 0,
  );

  const productIds = new Set<Id<"products">>();
  for (const p of zeroCostProducts) {
    if (p.stockQuantity > 0) productIds.add(p._id);
  }
  for (const row of branchTargets) {
    productIds.add(row.productId);
  }

  if (args.dryRun) {
    return {
      dryRun: true,
      organizationId: args.organizationId,
      productCount: productIds.size,
      sample: [...productIds].slice(0, 20),
    };
  }

  let clearedProducts = 0;
  let clearedBranchRows = 0;
  let clearedLots = 0;

  for (const productId of productIds) {
    const product = await ctx.db.get(productId);
    if (!product || product.organizationId !== args.organizationId) continue;
    if (product.costPrice !== 0) continue;

    const lots = await ctx.db
      .query("inventoryLots")
      .withIndex("by_product", (q) => q.eq("productId", product._id))
      .collect();
    for (const lot of lots) {
      if (lot.quantity <= 0) continue;
      await ctx.db.patch(lot._id, { quantity: 0 });
      clearedLots += 1;
    }

    const rows = await ctx.db
      .query("branchStock")
      .withIndex("by_product", (q) => q.eq("productId", product._id))
      .collect();

    for (const row of rows) {
      if (row.quantity <= 0) continue;
      await applyBranchStockChange(ctx, {
        branchId: row.branchId,
        productId: product._id,
        quantityChange: -row.quantity,
        reason: "adjustment",
        performedBy: args.performedBy,
        note: "Repair: zero-cost import stock cleared",
      });
      clearedBranchRows += 1;
    }

    if (product.stockQuantity !== 0) {
      await ctx.db.patch(product._id, { stockQuantity: 0 });
    }
    clearedProducts += 1;
  }

  if (args.performedBy) {
    await writeAuditLog(ctx, {
      actorId: args.performedBy,
      action: "repair_zero_cost_stock",
      entityType: "organizations",
      entityId: args.organizationId,
      organizationId: args.organizationId,
      metadata: { clearedProducts, clearedBranchRows, clearedLots },
    });
  }

  return {
    dryRun: false,
    organizationId: args.organizationId,
    clearedProducts,
    clearedBranchRows,
    clearedLots,
  };
}

const TRADING_HISTORY_BATCH = 40;

/**
 * Wipe sales / returns / held carts / receipts / expenses for one org so
 * dashboards look fresh. Never deletes or patches products, stock, lots, or
 * categories. Sale-linked inventory history rows are removed (quantities stay).
 */
async function clearTradingHistoryForOrg(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    dryRun: boolean;
    performedBy?: Id<"users">;
  },
) {
  const organizationId = args.organizationId;

  const [sales, returns, expenses, held, history, saleClientOps, returnClientOps] =
    await Promise.all([
      ctx.db
        .query("sales")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect(),
      ctx.db
        .query("saleReturns")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect(),
      ctx.db
        .query("expenses")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect(),
      ctx.db
        .query("heldSales")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect(),
      ctx.db
        .query("inventoryHistory")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect(),
      ctx.db
        .query("saleClientOps")
        .withIndex("by_organization_clientOperationId", (q) =>
          q.eq("organizationId", organizationId),
        )
        .collect(),
      ctx.db
        .query("saleReturnClientOps")
        .withIndex("by_organization_clientOperationId", (q) =>
          q.eq("organizationId", organizationId),
        )
        .collect(),
    ]);

  const saleHistory = history.filter(
    (row) =>
      row.relatedSaleId != null ||
      row.relatedReturnId != null ||
      row.reason === "sale" ||
      row.reason === "return",
  );

  // Receipts have no org index — count via sales for dry-run; delete per-sale below.
  let receiptCount = 0;
  if (args.dryRun) {
    for (const sale of sales.slice(0, 200)) {
      const rows = await ctx.db
        .query("receipts")
        .withIndex("by_sale", (q) => q.eq("saleId", sale._id))
        .collect();
      receiptCount += rows.length;
    }
    if (sales.length > 200) receiptCount = Math.max(receiptCount, sales.length);
  }

  if (args.dryRun) {
    return {
      dryRun: true,
      organizationId,
      sales: sales.length,
      returns: returns.length,
      expenses: expenses.length,
      heldSales: held.length,
      receiptsApprox: receiptCount,
      saleLinkedInventoryHistory: saleHistory.length,
      saleClientOps: saleClientOps.length,
      returnClientOps: returnClientOps.length,
    };
  }

  let deletedReturns = 0;
  let deletedSales = 0;
  let deletedExpenses = 0;
  let deletedHeld = 0;
  let deletedReceipts = 0;
  let deletedHistory = 0;
  let deletedClientOps = 0;

  for (const ret of returns.slice(0, TRADING_HISTORY_BATCH)) {
    const items = await ctx.db
      .query("saleReturnItems")
      .withIndex("by_return", (q) => q.eq("returnId", ret._id))
      .collect();
    for (const item of items) {
      const lots = await ctx.db
        .query("saleReturnItemLots")
        .withIndex("by_returnItem", (q) => q.eq("returnItemId", item._id))
        .collect();
      for (const lot of lots) await ctx.db.delete(lot._id);
      await ctx.db.delete(item._id);
    }
    for (const op of returnClientOps) {
      if (op.returnId === ret._id) {
        await ctx.db.delete(op._id);
        deletedClientOps += 1;
      }
    }
    await ctx.db.delete(ret._id);
    deletedReturns += 1;
  }

  if (returns.length > TRADING_HISTORY_BATCH) {
    return {
      dryRun: false,
      organizationId,
      done: false,
      deletedReturns,
      deletedSales,
      deletedExpenses,
      deletedHeld,
      deletedReceipts,
      deletedHistory,
      deletedClientOps,
      remainingReturns: returns.length - deletedReturns,
      remainingSales: sales.length,
    };
  }

  for (const sale of sales.slice(0, TRADING_HISTORY_BATCH)) {
    const items = await ctx.db
      .query("saleItems")
      .withIndex("by_sale", (q) => q.eq("saleId", sale._id))
      .collect();
    for (const item of items) {
      const lots = await ctx.db
        .query("saleItemLots")
        .withIndex("by_saleItem", (q) => q.eq("saleItemId", item._id))
        .collect();
      for (const lot of lots) await ctx.db.delete(lot._id);
      await ctx.db.delete(item._id);
    }
    const receiptRows = await ctx.db
      .query("receipts")
      .withIndex("by_sale", (q) => q.eq("saleId", sale._id))
      .collect();
    for (const receipt of receiptRows) {
      await ctx.db.delete(receipt._id);
      deletedReceipts += 1;
    }
    for (const op of saleClientOps) {
      if (op.saleId === sale._id) {
        await ctx.db.delete(op._id);
        deletedClientOps += 1;
      }
    }
    await ctx.db.delete(sale._id);
    deletedSales += 1;
  }

  if (sales.length > TRADING_HISTORY_BATCH) {
    return {
      dryRun: false,
      organizationId,
      done: false,
      deletedReturns,
      deletedSales,
      deletedExpenses,
      deletedHeld,
      deletedReceipts,
      deletedHistory,
      deletedClientOps,
      remainingReturns: 0,
      remainingSales: sales.length - deletedSales,
    };
  }

  for (const row of expenses) {
    await ctx.db.delete(row._id);
    deletedExpenses += 1;
  }
  for (const row of held) {
    await ctx.db.delete(row._id);
    deletedHeld += 1;
  }
  for (const row of saleHistory) {
    await ctx.db.delete(row._id);
    deletedHistory += 1;
  }

  const before = await ctx.db
    .query("organizationPlatformStats")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .unique();
  const previousSaleCount = before?.saleCount ?? 0;
  await recomputeOrgPlatformStats(ctx, organizationId);
  if (previousSaleCount > 0) {
    await incrementPlatformStats(ctx, { saleCount: -previousSaleCount });
  }

  if (args.performedBy) {
    await writeAuditLog(ctx, {
      actorId: args.performedBy,
      action: "repair_clear_trading_history",
      entityType: "organizations",
      entityId: organizationId,
      organizationId,
      metadata: {
        deletedReturns,
        deletedSales,
        deletedExpenses,
        deletedHeld,
        deletedReceipts,
        deletedHistory,
        deletedClientOps,
      },
    });
  }

  return {
    dryRun: false,
    organizationId,
    done: true,
    deletedReturns,
    deletedSales,
    deletedExpenses,
    deletedHeld,
    deletedReceipts,
    deletedHistory,
    deletedClientOps,
  };
}

async function findOrgByName(ctx: MutationCtx, organizationName: string) {
  const needle = organizationName.trim().toLowerCase();
  const orgs = await ctx.db.query("organizations").collect();
  const org = orgs.find((row) => row.name.trim().toLowerCase() === needle);
  if (!org) throw new Error(`Organization not found: ${organizationName}`);
  return org;
}

export const clearTradingHistoryInternal = internalMutation({
  args: {
    organizationName: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const org = await findOrgByName(ctx, args.organizationName);
    return await clearTradingHistoryForOrg(ctx, {
      organizationId: org._id,
      dryRun: args.dryRun === true,
    });
  },
});

/** Platform admin — clears sales/returns/expenses for an org. Prefer dryRun first. */
export const clearTradingHistory = mutation({
  args: {
    organizationName: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const org = await findOrgByName(ctx, args.organizationName);
    return await clearTradingHistoryForOrg(ctx, {
      organizationId: org._id,
      dryRun: args.dryRun === true,
      performedBy: userId,
    });
  },
});

export const zeroZeroCostStockInternal = internalMutation({
  args: {
    organizationName: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const org = await findOrgByName(ctx, args.organizationName);
    return await zeroZeroCostStockForOrg(ctx, {
      organizationId: org._id,
      dryRun: args.dryRun === true,
    });
  },
});

/** Platform admin entry — prefer dryRun first. */
export const zeroZeroCostStock = mutation({
  args: {
    organizationName: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const org = await findOrgByName(ctx, args.organizationName);
    return await zeroZeroCostStockForOrg(ctx, {
      organizationId: org._id,
      dryRun: args.dryRun === true,
      performedBy: userId,
    });
  },
});
