import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { roundMoney } from "./validation";
import { allocateReturnNumber, sanitizeReturnNumber } from "./documentReferences";

type Ctx = QueryCtx | MutationCtx;

export type ReturnableLine = {
  saleItemId: Id<"saleItems">;
  productId: Id<"products">;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  discount: number;
  lineTotal: number;
  returnedQuantity: number;
  remainingQuantity: number;
};

export function lineRefundAmount(args: {
  returningQty: number;
  soldQty: number;
  lineTotal: number;
  saleSubtotal: number;
  saleCartDiscount: number;
}): number {
  if (args.returningQty <= 0 || args.soldQty <= 0) return 0;
  const gross = (args.returningQty / args.soldQty) * args.lineTotal;
  const cartShare = args.saleSubtotal > 0 ? (gross / args.saleSubtotal) * args.saleCartDiscount : 0;
  return roundMoney(Math.max(0, gross - cartShare));
}

export async function loadPriorReturnTotals(ctx: Ctx, saleId: Id<"sales">) {
  const returns = await ctx.db
    .query("saleReturns")
    .withIndex("by_sale", (q) => q.eq("saleId", saleId))
    .collect();
  const completed = returns.filter((row) => row.status === "completed");
  const returnIds = completed.map((row) => row._id);
  const items: Doc<"saleReturnItems">[] = [];
  for (const returnId of returnIds) {
    const rows = await ctx.db
      .query("saleReturnItems")
      .withIndex("by_return", (q) => q.eq("returnId", returnId))
      .collect();
    items.push(...rows);
  }
  const returnedBySaleItem = new Map<Id<"saleItems">, number>();
  for (const item of items) {
    returnedBySaleItem.set(
      item.saleItemId,
      (returnedBySaleItem.get(item.saleItemId) ?? 0) + item.quantity,
    );
  }
  const refundedAmount = roundMoney(completed.reduce((sum, row) => sum + row.refundAmount, 0));
  return { returns: completed, items, returnedBySaleItem, refundedAmount };
}

export async function loadReturnableLines(
  ctx: Ctx,
  saleId: Id<"sales">,
): Promise<{
  items: ReturnableLine[];
  refundedAmount: number;
  returns: Doc<"saleReturns">[];
}> {
  const saleItems = await ctx.db
    .query("saleItems")
    .withIndex("by_sale", (q) => q.eq("saleId", saleId))
    .collect();
  const prior = await loadPriorReturnTotals(ctx, saleId);
  return {
    refundedAmount: prior.refundedAmount,
    returns: prior.returns,
    items: saleItems.map((item) => {
      const returnedQuantity = prior.returnedBySaleItem.get(item._id) ?? 0;
      return {
        saleItemId: item._id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        discount: item.discount,
        lineTotal: item.lineTotal,
        returnedQuantity,
        remainingQuantity: Math.max(0, item.quantity - returnedQuantity),
      };
    }),
  };
}

export async function loadReturnedLotQty(ctx: Ctx, saleItemId: Id<"saleItems">) {
  const returnItems = await ctx.db
    .query("saleReturnItems")
    .withIndex("by_saleItem", (q) => q.eq("saleItemId", saleItemId))
    .collect();
  const byLot = new Map<Id<"inventoryLots">, number>();
  for (const item of returnItems) {
    const lots = await ctx.db
      .query("saleReturnItemLots")
      .withIndex("by_returnItem", (q) => q.eq("returnItemId", item._id))
      .collect();
    for (const lot of lots) {
      byLot.set(lot.lotId, (byLot.get(lot.lotId) ?? 0) + lot.quantity);
    }
  }
  return byLot;
}

async function returnNumberTaken(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  returnNumber: string,
) {
  const existing = await ctx.db
    .query("saleReturns")
    .withIndex("by_organization_returnNumber", (q) =>
      q.eq("organizationId", organizationId).eq("returnNumber", returnNumber),
    )
    .unique();
  return existing !== null;
}

export async function nextReturnNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  requested?: string,
) {
  if (requested?.trim()) {
    const returnNumber = sanitizeReturnNumber(requested);
    if (await returnNumberTaken(ctx, organizationId, returnNumber)) {
      throw new Error("This return number is already used");
    }
    return returnNumber;
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const reference = allocateReturnNumber();
    if (!(await returnNumberTaken(ctx, organizationId, reference))) return reference;
  }
  throw new Error("Could not allocate a unique return reference");
}

export function unitCostForLine(
  item: { unitCost?: number; productId: Id<"products"> },
  costByProduct: Map<Id<"products">, number>,
) {
  return item.unitCost !== undefined ? item.unitCost : (costByProduct.get(item.productId) ?? 0);
}

export function cogsForLines(
  items: Array<{ unitCost?: number; productId: Id<"products">; quantity: number }>,
  costByProduct: Map<Id<"products">, number>,
) {
  let total = 0;
  for (const item of items) {
    total += unitCostForLine(item, costByProduct) * item.quantity;
  }
  return roundMoney(total);
}

export async function loadItemsForReturns(ctx: Ctx, returnIds: Id<"saleReturns">[]) {
  const items: Doc<"saleReturnItems">[] = [];
  for (const returnId of returnIds) {
    const rows = await ctx.db
      .query("saleReturnItems")
      .withIndex("by_return", (q) => q.eq("returnId", returnId))
      .collect();
    items.push(...rows);
  }
  return items;
}

export async function completedReturnsInRange(
  ctx: Ctx,
  args: {
    startDate: number;
    endDate: number;
    organizationId: Id<"organizations">;
    branchId?: Id<"branches"> | null;
    cashierSaleIds?: Set<Id<"sales">>;
  },
) {
  const rows = await ctx.db
    .query("saleReturns")
    .withIndex("by_organization_completedAt", (q) =>
      q
        .eq("organizationId", args.organizationId)
        .gte("completedAt", args.startDate)
        .lte("completedAt", args.endDate),
    )
    .collect();
  return rows.filter((row) => {
    if (row.status !== "completed") return false;
    if (args.branchId && row.branchId !== args.branchId) return false;
    if (args.cashierSaleIds && !args.cashierSaleIds.has(row.saleId)) return false;
    return true;
  });
}
