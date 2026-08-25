import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

export async function getBranchStockRow(
  ctx: Ctx,
  branchId: Id<"branches">,
  productId: Id<"products">,
) {
  return await ctx.db
    .query("branchStock")
    .withIndex("by_branch_product", (q) => q.eq("branchId", branchId).eq("productId", productId))
    .unique();
}

export async function getBranchQuantity(
  ctx: Ctx,
  branchId: Id<"branches">,
  productId: Id<"products">,
) {
  const row = await getBranchStockRow(ctx, branchId, productId);
  return row?.quantity ?? 0;
}

export async function ensureBranchStockRow(
  ctx: MutationCtx,
  branchId: Id<"branches">,
  productId: Id<"products">,
  initialQuantity = 0,
) {
  const existing = await getBranchStockRow(ctx, branchId, productId);
  if (existing) return existing;
  const branch = await ctx.db.get(branchId);
  if (!branch) throw new Error("Branch not found");
  const id = await ctx.db.insert("branchStock", {
    organizationId: branch.organizationId,
    branchId,
    productId,
    quantity: Math.max(0, Math.floor(initialQuantity)),
  });
  return (await ctx.db.get(id))!;
}

/** Apply a stock delta for a branch. Rejects negative resulting stock. */
export async function applyBranchStockChange(
  ctx: MutationCtx,
  args: {
    branchId: Id<"branches">;
    productId: Id<"products">;
    quantityChange: number;
    reason:
      | "sale"
      | "receive"
      | "adjustment"
      | "damage"
      | "return"
      | "expiry"
      | "seed"
      | "transfer_out"
      | "transfer_in"
      | "wholesale_receive"
      | "wholesale_issue";
    performedBy?: Id<"users">;
    note?: string;
    relatedSaleId?: Id<"sales">;
    relatedReturnId?: Id<"saleReturns">;
    relatedTransferId?: Id<"stockTransfers">;
    relatedLotId?: Id<"inventoryLots">;
  },
) {
  const change = Math.trunc(args.quantityChange);
  const row = await ensureBranchStockRow(ctx, args.branchId, args.productId, 0);
  const next = row.quantity + change;
  if (next < 0) {
    throw new Error("Insufficient stock for this branch");
  }
  await ctx.db.patch(row._id, { quantity: next });
  await ctx.db.insert("inventoryHistory", {
    organizationId: row.organizationId,
    productId: args.productId,
    branchId: args.branchId,
    quantityChange: change,
    quantityAfter: next,
    reason: args.reason,
    note: args.note,
    performedBy: args.performedBy,
    relatedSaleId: args.relatedSaleId,
    relatedReturnId: args.relatedReturnId,
    relatedTransferId: args.relatedTransferId,
    relatedLotId: args.relatedLotId,
  });
  return next;
}

export async function stockMapForBranch(
  ctx: Ctx,
  branchId: Id<"branches">,
): Promise<Map<Id<"products">, number>> {
  const rows = await ctx.db
    .query("branchStock")
    .withIndex("by_branch", (q) => q.eq("branchId", branchId))
    .collect();
  const map = new Map<Id<"products">, number>();
  for (const row of rows) {
    map.set(row.productId, row.quantity);
  }
  return map;
}

/** Sum quantities across every branch in the session organization. */
export async function stockMapOrgWide(
  ctx: Ctx,
  organizationId: Id<"organizations">,
): Promise<Map<Id<"products">, number>> {
  const rows = await ctx.db
    .query("branchStock")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();
  const map = new Map<Id<"products">, number>();
  for (const row of rows) {
    map.set(row.productId, (map.get(row.productId) ?? 0) + row.quantity);
  }
  return map;
}
