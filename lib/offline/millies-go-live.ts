/**
 * Millie's Go live — remove tagged samples or wipe operational Dexie tables.
 */

import { getOfflineDb } from "./db";
import {
  getMilliesSampleDataStatus,
  MILLIES_AUTH_META,
  setAuthMeta,
  type MilliesSampleDataStatus,
} from "./millies-auth-db";
import type { MilliesSessionUser } from "./millies-auth";

export type MilliesGoLiveMode = "samples" | "operations";

const OPS_CLEAR_TABLES = [
  "categories",
  "products",
  "branchStock",
  "lots",
  "customers",
  "suppliers",
  "orders",
  "orderItems",
  "localSales",
  "localSaleItems",
  "localReceipts",
  "heldSales",
  "returns",
  "returnItems",
  "expenses",
  "inventoryHistory",
  "outbox",
] as const;

async function wipeSamplesOnly(): Promise<{ products: number; orders: number; categories: number }> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local business database unavailable");

  const products = await db.products.filter((p) => p.isSample === true).toArray();
  for (const product of products) {
    await db.branchStock.where("productId").equals(product.id).delete();
    await db.lots.where("productId").equals(product.id).delete();
    await db.products.delete(product.id);
  }

  const orders = await db.orders.filter((o) => o.isSample === true).toArray();
  for (const order of orders) {
    await db.orderItems.where("orderId").equals(order.id).delete();
    await db.orders.delete(order.id);
  }

  const categories = await db.categories.filter((c) => c.isSample === true).toArray();
  for (const cat of categories) {
    await db.categories.delete(cat.id);
  }

  return {
    products: products.length,
    orders: orders.length,
    categories: categories.length,
  };
}

async function wipeOperations(): Promise<{ tables: number }> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local business database unavailable");

  let tables = 0;
  for (const name of OPS_CLEAR_TABLES) {
    const table = (db as unknown as Record<string, { count: () => Promise<number>; clear: () => Promise<void> }>)[
      name
    ];
    if (!table?.clear) continue;
    const count = await table.count();
    await table.clear();
    if (count > 0) tables += 1;
  }
  return { tables };
}

export async function milliesGoLive(input: {
  mode: MilliesGoLiveMode;
  user: MilliesSessionUser;
  confirmation?: string;
}): Promise<{ mode: MilliesGoLiveMode; summary: Record<string, number> }> {
  if (input.user.role !== "administrator") {
    throw new Error("Only administrators can go live.");
  }
  const status = await getMilliesSampleDataStatus();
  if (status !== "active") {
    throw new Error("Go live is only available while sample data is active.");
  }
  if (input.mode === "operations" && input.confirmation !== "CLEAR") {
    throw new Error("Type CLEAR to confirm clearing all operational data.");
  }

  const summary =
    input.mode === "samples" ? await wipeSamplesOnly() : await wipeOperations();

  await setAuthMeta(MILLIES_AUTH_META.sampleDataStatus, "cleared");
  return { mode: input.mode, summary };
}

export async function milliesSampleDataIsActive(): Promise<boolean> {
  return (await getMilliesSampleDataStatus()) === "active";
}

export type { MilliesSampleDataStatus };
