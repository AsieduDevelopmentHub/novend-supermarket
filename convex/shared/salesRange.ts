import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

/** Org sales in a completedAt window — avoids a full-table collect + JS date filter. */
export async function collectSalesInCompletedAtRange(
  ctx: Ctx,
  organizationId: Id<"organizations">,
  startDate: number,
  endDate: number,
) {
  return ctx.db
    .query("sales")
    .withIndex("by_organization_completedAt", (q) =>
      q
        .eq("organizationId", organizationId)
        .gte("completedAt", startDate)
        .lte("completedAt", endDate),
    )
    .collect();
}

/** Line items for a known set of sales — `by_sale` instead of an org-wide collect. */
export async function collectSaleItemsForSales(ctx: Ctx, saleIds: Id<"sales">[]) {
  const items: Doc<"saleItems">[] = [];
  for (const saleId of saleIds) {
    const rows = await ctx.db
      .query("saleItems")
      .withIndex("by_sale", (q) => q.eq("saleId", saleId))
      .collect();
    items.push(...rows);
  }
  return items;
}

/** Org expenses in an occurredAt window. */
export async function collectExpensesInOccurredAtRange(
  ctx: Ctx,
  organizationId: Id<"organizations">,
  startDate: number,
  endDate: number,
) {
  return ctx.db
    .query("expenses")
    .withIndex("by_organization_occurredAt", (q) =>
      q
        .eq("organizationId", organizationId)
        .gte("occurredAt", startDate)
        .lte("occurredAt", endDate),
    )
    .collect();
}
