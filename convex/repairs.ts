import { v } from "convex/values";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePlatformAdmin } from "./shared/permissions";
import { applyBranchStockChange } from "./shared/branchStock";
import { writeAuditLog } from "./shared/audit";

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

  const zeroCostProducts = products.filter(
    (p) => p.costPrice === 0 && p.status !== "archived",
  );
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

export const zeroZeroCostStockInternal = internalMutation({
  args: {
    organizationName: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const needle = args.organizationName.trim().toLowerCase();
    const orgs = await ctx.db.query("organizations").collect();
    const org = orgs.find((row) => row.name.trim().toLowerCase() === needle);
    if (!org) {
      throw new Error(`Organization not found: ${args.organizationName}`);
    }
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
    const needle = args.organizationName.trim().toLowerCase();
    const orgs = await ctx.db.query("organizations").collect();
    const org = orgs.find((row) => row.name.trim().toLowerCase() === needle);
    if (!org) {
      throw new Error(`Organization not found: ${args.organizationName}`);
    }
    return await zeroZeroCostStockForOrg(ctx, {
      organizationId: org._id,
      dryRun: args.dryRun === true,
      performedBy: userId,
    });
  },
});
