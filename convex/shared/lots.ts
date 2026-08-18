import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { applyBranchStockChange } from "./branchStock";
import { sanitizeOptionalText, TEXT_LIMITS } from "./validation";

type Ctx = QueryCtx | MutationCtx;

export const DEFAULT_EXPIRY_ALERT_DAYS = 30;
const EXPIRY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type InventoryReason =
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

export type LotStatus = "expired" | "expiring" | "ok";

export type LotAllocation = {
  lotId: Id<"inventoryLots">;
  quantity: number;
  expiryDate: string;
};

export type LotSummary = {
  sellableQuantity: number;
  expiredQuantity: number;
  nearestExpiry: string | null;
  nearestSellableExpiry: string | null;
};

export function todayDateString(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function assertExpiryDate(value: string): string {
  if (!EXPIRY_DATE_PATTERN.test(value)) {
    throw new Error("Expiry date must be YYYY-MM-DD");
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Invalid expiry date");
  }
  return value;
}

export function productTracksExpiry(product: { tracksExpiry?: boolean }): boolean {
  return product.tracksExpiry === true;
}

export function productExpiryAlertDays(product: { expiryAlertDays?: number }): number {
  const days = product.expiryAlertDays;
  if (typeof days === "number" && Number.isFinite(days) && days >= 0) {
    return Math.floor(days);
  }
  return DEFAULT_EXPIRY_ALERT_DAYS;
}

export function daysUntilExpiry(expiryDate: string, today = todayDateString()): number {
  const start = Date.parse(`${today}T00:00:00.000Z`);
  const end = Date.parse(`${expiryDate}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000);
}

export function lotStatus(
  expiryDate: string,
  alertDays: number,
  today = todayDateString(),
): LotStatus {
  const days = daysUntilExpiry(expiryDate, today);
  if (days < 0) return "expired";
  if (days <= alertDays) return "expiring";
  return "ok";
}

export function isExpiringSoon(
  nearestSellableExpiry: string | null,
  alertDays: number,
  today = todayDateString(),
): boolean {
  if (!nearestSellableExpiry) return false;
  return lotStatus(nearestSellableExpiry, alertDays, today) === "expiring";
}

export type ExpiryListFields = {
  tracksExpiry: boolean;
  expiryAlertDays: number | null;
  sellableQuantity: number;
  expiredQuantity: number;
  nearestExpiry: string | null;
  nearestSellableExpiry: string | null;
  isExpired: boolean;
  isExpiring: boolean;
  isLowStock: boolean;
  statusLabel: "Expired" | "Expiring" | "Low Stock" | "In Stock";
};

export function deriveExpiryListFields(
  product: { tracksExpiry?: boolean; expiryAlertDays?: number; lowStockThreshold: number },
  onHand: number,
  summary?: LotSummary,
): ExpiryListFields {
  const tracksExpiry = productTracksExpiry(product);
  const expiryAlertDays = tracksExpiry ? productExpiryAlertDays(product) : null;
  const sellableQuantity = tracksExpiry ? (summary?.sellableQuantity ?? 0) : onHand;
  const expiredQuantity = tracksExpiry ? (summary?.expiredQuantity ?? 0) : 0;
  const nearestExpiry = tracksExpiry ? (summary?.nearestExpiry ?? null) : null;
  const nearestSellableExpiry = tracksExpiry ? (summary?.nearestSellableExpiry ?? null) : null;
  const isExpired = expiredQuantity > 0;
    const isExpiring = isExpiringSoon(
      nearestSellableExpiry,
      expiryAlertDays ?? DEFAULT_EXPIRY_ALERT_DAYS,
    );
  const isLowStock = sellableQuantity <= product.lowStockThreshold;
  const statusLabel: ExpiryListFields["statusLabel"] = isExpired
    ? "Expired"
    : isExpiring
      ? "Expiring"
      : isLowStock
        ? "Low Stock"
        : "In Stock";
  return {
    tracksExpiry,
    expiryAlertDays,
    sellableQuantity,
    expiredQuantity,
    nearestExpiry,
    nearestSellableExpiry,
    isExpired,
    isExpiring,
    isLowStock,
    statusLabel,
  };
}

function emptySummary(): LotSummary {
  return {
    sellableQuantity: 0,
    expiredQuantity: 0,
    nearestExpiry: null,
    nearestSellableExpiry: null,
  };
}

function addLotToSummary(summary: LotSummary, lot: Doc<"inventoryLots">, today: string) {
  if (lot.quantity <= 0) return;
  if (lot.expiryDate < today) {
    summary.expiredQuantity += lot.quantity;
  } else {
    summary.sellableQuantity += lot.quantity;
  }
  if (!summary.nearestExpiry || lot.expiryDate < summary.nearestExpiry) {
    summary.nearestExpiry = lot.expiryDate;
  }
  if (
    lot.expiryDate >= today &&
    (!summary.nearestSellableExpiry || lot.expiryDate < summary.nearestSellableExpiry)
  ) {
    summary.nearestSellableExpiry = lot.expiryDate;
  }
}

export async function listLotsForProductBranch(
  ctx: Ctx,
  branchId: Id<"branches">,
  productId: Id<"products">,
) {
  return await ctx.db
    .query("inventoryLots")
    .withIndex("by_branch_product", (q) => q.eq("branchId", branchId).eq("productId", productId))
    .collect();
}

export async function lotSummaries(
  ctx: Ctx,
  branchId?: Id<"branches"> | null,
): Promise<Map<Id<"products">, LotSummary>> {
  const today = todayDateString();
  const rows = branchId
    ? await ctx.db
        .query("inventoryLots")
        .withIndex("by_branch", (q) => q.eq("branchId", branchId))
        .collect()
    : await ctx.db.query("inventoryLots").collect();

  const map = new Map<Id<"products">, LotSummary>();
  for (const lot of rows) {
    const current = map.get(lot.productId) ?? emptySummary();
    addLotToSummary(current, lot, today);
    map.set(lot.productId, current);
  }
  return map;
}

export async function getSellableQuantity(
  ctx: Ctx,
  branchId: Id<"branches">,
  productId: Id<"products">,
) {
  const today = todayDateString();
  const lots = await listLotsForProductBranch(ctx, branchId, productId);
  return lots.reduce((sum, lot) => {
    if (lot.quantity <= 0 || lot.expiryDate < today) return sum;
    return sum + lot.quantity;
  }, 0);
}

export async function remainingLotQuantity(
  ctx: Ctx,
  productId: Id<"products">,
): Promise<number> {
  const lots = await ctx.db
    .query("inventoryLots")
    .withIndex("by_product", (q) => q.eq("productId", productId))
    .collect();
  return lots.reduce((sum, lot) => sum + Math.max(0, lot.quantity), 0);
}

async function findLotByExpiry(
  ctx: Ctx,
  branchId: Id<"branches">,
  productId: Id<"products">,
  expiryDate: string,
) {
  return await ctx.db
    .query("inventoryLots")
    .withIndex("by_branch_product_expiry", (q) =>
      q.eq("branchId", branchId).eq("productId", productId).eq("expiryDate", expiryDate),
    )
    .unique();
}

function sortFefo(lots: Doc<"inventoryLots">[]) {
  return [...lots].sort((a, b) => {
    if (a.expiryDate !== b.expiryDate) return a.expiryDate.localeCompare(b.expiryDate);
    return a.receivedAt - b.receivedAt;
  });
}

export async function increaseLot(
  ctx: MutationCtx,
  args: {
    branchId: Id<"branches">;
    productId: Id<"products">;
    quantity: number;
    expiryDate: string;
    reason: InventoryReason;
    performedBy?: Id<"users">;
    note?: string;
    relatedSaleId?: Id<"sales">;
    relatedReturnId?: Id<"saleReturns">;
    relatedTransferId?: Id<"stockTransfers">;
    lotCode?: string;
  },
) {
  const quantity = Math.trunc(args.quantity);
  if (quantity <= 0) throw new Error("Quantity must be a positive integer");
  const expiryDate = assertExpiryDate(args.expiryDate);
  const lotCode = sanitizeOptionalText(args.lotCode, "Lot code", TEXT_LIMITS.sku) || undefined;

  let lot = await findLotByExpiry(ctx, args.branchId, args.productId, expiryDate);
  if (lot) {
    await ctx.db.patch(lot._id, { quantity: lot.quantity + quantity });
  } else {
    const branch = await ctx.db.get(args.branchId);
    if (!branch) throw new Error("Branch not found");
    const lotId = await ctx.db.insert("inventoryLots", {
      organizationId: branch.organizationId,
      branchId: args.branchId,
      productId: args.productId,
      quantity,
      expiryDate,
      receivedAt: Date.now(),
      lotCode: lotCode ?? expiryDate,
    });
    lot = (await ctx.db.get(lotId))!;
  }

  await applyBranchStockChange(ctx, {
    branchId: args.branchId,
    productId: args.productId,
    quantityChange: quantity,
    reason: args.reason,
    performedBy: args.performedBy,
    note: args.note,
    relatedSaleId: args.relatedSaleId,
    relatedReturnId: args.relatedReturnId,
    relatedTransferId: args.relatedTransferId,
    relatedLotId: lot._id,
  });

  return lot._id;
}

export async function decreaseLots(
  ctx: MutationCtx,
  args: {
    branchId: Id<"branches">;
    productId: Id<"products">;
    quantity: number;
    reason: InventoryReason;
    sellableOnly: boolean;
    productName?: string;
    lotId?: Id<"inventoryLots">;
    performedBy?: Id<"users">;
    note?: string;
    relatedSaleId?: Id<"sales">;
    relatedTransferId?: Id<"stockTransfers">;
  },
): Promise<LotAllocation[]> {
  const need = Math.trunc(args.quantity);
  if (need <= 0) throw new Error("Quantity must be a positive integer");
  const today = todayDateString();
  const allocations: LotAllocation[] = [];

  if (args.lotId) {
    const lot = await ctx.db.get(args.lotId);
    if (!lot || lot.branchId !== args.branchId || lot.productId !== args.productId) {
      throw new Error("Lot not found for this product and branch");
    }
    if (args.sellableOnly && lot.expiryDate < today) {
      throw new Error("Expired stock cannot be sold. Write it off from Inventory.");
    }
    if (lot.quantity < need) {
      throw new Error("Insufficient quantity in the selected lot");
    }
    await ctx.db.patch(lot._id, { quantity: lot.quantity - need });
    await applyBranchStockChange(ctx, {
      branchId: args.branchId,
      productId: args.productId,
      quantityChange: -need,
      reason: args.reason,
      performedBy: args.performedBy,
      note: args.note,
      relatedSaleId: args.relatedSaleId,
      relatedTransferId: args.relatedTransferId,
      relatedLotId: lot._id,
    });
    return [{ lotId: lot._id, quantity: need, expiryDate: lot.expiryDate }];
  }

  let lots = (await listLotsForProductBranch(ctx, args.branchId, args.productId)).filter(
    (lot) => lot.quantity > 0,
  );
  if (args.sellableOnly) {
    lots = lots.filter((lot) => lot.expiryDate >= today);
  }
  lots = sortFefo(lots);

  let remaining = need;
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.quantity, remaining);
    await ctx.db.patch(lot._id, { quantity: lot.quantity - take });
    await applyBranchStockChange(ctx, {
      branchId: args.branchId,
      productId: args.productId,
      quantityChange: -take,
      reason: args.reason,
      performedBy: args.performedBy,
      note: args.note,
      relatedSaleId: args.relatedSaleId,
      relatedTransferId: args.relatedTransferId,
      relatedLotId: lot._id,
    });
    allocations.push({ lotId: lot._id, quantity: take, expiryDate: lot.expiryDate });
    remaining -= take;
  }

  if (remaining > 0) {
    const name = args.productName ? ` for ${args.productName}` : "";
    if (args.sellableOnly) {
      throw new Error(
        `Insufficient sellable stock${name}. Expired units must be written off from Inventory.`,
      );
    }
    throw new Error(`Insufficient stock${name}`);
  }

  return allocations;
}

export async function writeOffExpiredLots(
  ctx: MutationCtx,
  args: {
    branchId: Id<"branches">;
    productId: Id<"products">;
    lotId?: Id<"inventoryLots">;
    performedBy?: Id<"users">;
    note?: string;
  },
) {
  const today = todayDateString();
  const lots = args.lotId
    ? [await ctx.db.get(args.lotId)].filter((lot): lot is Doc<"inventoryLots"> => Boolean(lot))
    : await listLotsForProductBranch(ctx, args.branchId, args.productId);

  let writtenOff = 0;
  for (const lot of lots) {
    if (lot.branchId !== args.branchId || lot.productId !== args.productId) {
      throw new Error("Lot not found for this product and branch");
    }
    if (lot.quantity <= 0 || lot.expiryDate >= today) continue;
    await decreaseLots(ctx, {
      branchId: args.branchId,
      productId: args.productId,
      quantity: lot.quantity,
      reason: "expiry",
      sellableOnly: false,
      lotId: lot._id,
      performedBy: args.performedBy,
      note: args.note ?? "Expired stock written off",
    });
    writtenOff += lot.quantity;
  }

  if (writtenOff <= 0) {
    throw new Error("No expired stock to write off");
  }
  return writtenOff;
}

export async function convertOnHandToOpeningLots(
  ctx: MutationCtx,
  args: {
    productId: Id<"products">;
    expiryDate: string;
    performedBy?: Id<"users">;
  },
) {
  const expiryDate = assertExpiryDate(args.expiryDate);
  const rows = await ctx.db
    .query("branchStock")
    .withIndex("by_product", (q) => q.eq("productId", args.productId))
    .collect();

  for (const row of rows) {
    if (row.quantity <= 0) continue;
    const existing = await listLotsForProductBranch(ctx, row.branchId, args.productId);
    const lotQty = existing.reduce((sum, lot) => sum + lot.quantity, 0);
    if (lotQty > 0) continue;
    await ctx.db.insert("inventoryLots", {
      organizationId: row.organizationId,
      branchId: row.branchId,
      productId: args.productId,
      quantity: row.quantity,
      expiryDate,
      receivedAt: Date.now(),
      lotCode: expiryDate,
    });
    await ctx.db.insert("inventoryHistory", {
      organizationId: row.organizationId,
      productId: args.productId,
      branchId: row.branchId,
      quantityChange: 0,
      quantityAfter: row.quantity,
      reason: "adjustment",
      note: `Converted on-hand stock to expiry lot ${expiryDate}`,
      performedBy: args.performedBy,
    });
  }
}

export async function applyInventoryMovement(
  ctx: MutationCtx,
  args: {
    product: Doc<"products">;
    branchId: Id<"branches">;
    quantityChange: number;
    reason: InventoryReason;
    expiryDate?: string;
    lotId?: Id<"inventoryLots">;
    performedBy?: Id<"users">;
    note?: string;
    relatedSaleId?: Id<"sales">;
    relatedTransferId?: Id<"stockTransfers">;
    lotCode?: string;
  },
) {
  const change = Math.trunc(args.quantityChange);
  if (change === 0) throw new Error("Quantity change must be a non-zero integer");

  if (!productTracksExpiry(args.product)) {
    return applyBranchStockChange(ctx, {
      branchId: args.branchId,
      productId: args.product._id,
      quantityChange: change,
      reason: args.reason,
      performedBy: args.performedBy,
      note: args.note,
      relatedSaleId: args.relatedSaleId,
      relatedTransferId: args.relatedTransferId,
    });
  }

  if (change > 0) {
    if (!args.expiryDate) {
      throw new Error("Expiry date is required for dated products");
    }
    await increaseLot(ctx, {
      branchId: args.branchId,
      productId: args.product._id,
      quantity: change,
      expiryDate: args.expiryDate,
      reason: args.reason,
      performedBy: args.performedBy,
      note: args.note,
      relatedSaleId: args.relatedSaleId,
      relatedTransferId: args.relatedTransferId,
      lotCode: args.lotCode,
    });
    return;
  }

  await decreaseLots(ctx, {
    branchId: args.branchId,
    productId: args.product._id,
    quantity: -change,
    reason: args.reason,
    sellableOnly: false,
    productName: args.product.name,
    lotId: args.lotId,
    performedBy: args.performedBy,
    note: args.note,
    relatedSaleId: args.relatedSaleId,
    relatedTransferId: args.relatedTransferId,
  });
}

