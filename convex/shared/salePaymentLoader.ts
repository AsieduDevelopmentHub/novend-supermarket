import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import type { SalePaymentLine } from "./salePayments";

/**
 * Tender lines for many sales (reports). Sales without rows are omitted so
 * callers fall back to the primary `paymentMethod` for the whole total.
 */
export async function loadPaymentsBySale(
  ctx: QueryCtx | MutationCtx,
  sales: Array<Pick<Doc<"sales">, "_id" | "organizationId">>,
): Promise<Map<string, SalePaymentLine[]>> {
  const groups = await Promise.all(
    sales.map((sale) =>
      ctx.db
        .query("salePayments")
        .withIndex("by_sale", (q) => q.eq("saleId", sale._id))
        .collect(),
    ),
  );
  const out = new Map<string, SalePaymentLine[]>();
  sales.forEach((sale, index) => {
    const rows = (groups[index] ?? []).filter((row) => row.organizationId === sale.organizationId);
    if (rows.length > 0) {
      out.set(
        sale._id,
        rows.map((row) => ({ method: row.method, amount: row.amount })),
      );
    }
  });
  return out;
}

/** Tender lines for a sale. Legacy sales (before split tenders) get one line. */
export async function loadSalePayments(
  ctx: QueryCtx | MutationCtx,
  sale: Doc<"sales">,
): Promise<SalePaymentLine[]> {
  const rows = await ctx.db
    .query("salePayments")
    .withIndex("by_sale", (q) => q.eq("saleId", sale._id))
    .collect();
  const scoped = rows.filter((row) => row.organizationId === sale.organizationId);
  if (scoped.length === 0) {
    return sale.total > 0 ? [{ method: sale.paymentMethod, amount: sale.total }] : [];
  }
  return scoped.map((row) => ({ method: row.method, amount: row.amount }));
}
