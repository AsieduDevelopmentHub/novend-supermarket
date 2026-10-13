import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { assertOrgDoc, requireRole } from "./shared/permissions";
import { writeAuditLog } from "./shared/audit";
import { rememberClientOp, replayClientOp } from "./shared/clientOps";
import { settlementMethodValidator } from "./shared/paymentMethod";
import { hasBusinessCapability } from "./shared/businessCapabilities";
import {
  assertPaymentWithinBalance,
  customerBalance,
  summarizeAging,
  type AgingSummary,
} from "./shared/customerCredit";
import { roundMoney, sanitizeOptionalText, TEXT_LIMITS } from "./shared/validation";
import { loadBusinessConfiguration } from "./settings";

type DbCtx = QueryCtx | MutationCtx;

async function assertCreditEnabled(ctx: DbCtx, organizationId: Id<"organizations">) {
  const config = await loadBusinessConfiguration(ctx, organizationId);
  if (!hasBusinessCapability(config, "customer_credit")) {
    throw new Error("Customer credit is not enabled for this organization");
  }
}

async function loadEntries(
  ctx: DbCtx,
  organizationId: Id<"organizations">,
  customerId: Id<"customers">,
): Promise<Doc<"customerLedgerEntries">[]> {
  return await ctx.db
    .query("customerLedgerEntries")
    .withIndex("by_organization_customer_occurredAt", (q) =>
      q.eq("organizationId", organizationId).eq("customerId", customerId),
    )
    .collect();
}

export const listForCustomer = query({
  args: {
    customerId: v.id("customers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.organizationId !== organizationId) return [];
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const entries = await loadEntries(ctx, organizationId, args.customerId);
    return entries
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, limit)
      .map((row) => ({
        id: row._id,
        type: row.type,
        amount: row.amount,
        saleId: row.saleId ?? null,
        returnId: row.returnId ?? null,
        method: row.method ?? null,
        note: row.note ?? null,
        occurredAt: row.occurredAt,
      }));
  },
});

/** Balance, limit, and aging for one customer. Cashiers need it at checkout. */
export const balance = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager", "cashier"]);
    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.organizationId !== organizationId) return null;
    const entries = await loadEntries(ctx, organizationId, args.customerId);
    const owed = customerBalance(entries);
    const limit = customer.creditLimit ?? null;
    return {
      customerId: customer._id,
      balance: owed,
      creditLimit: limit,
      available: limit === null ? null : roundMoney(Math.max(0, limit - owed)),
      aging: summarizeAging(entries, Date.now()),
    };
  },
});

export const recordPayment = mutation({
  args: {
    customerId: v.id("customers"),
    amount: v.number(),
    method: settlementMethodValidator,
    note: v.optional(v.string()),
    /** Till wall-clock when the payment was taken (offline outbox). */
    paidAt: v.optional(v.number()),
    clientOperationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const replayed = await replayClientOp<{ entryId: Id<"customerLedgerEntries">; balance: number }>(
      ctx,
      organizationId,
      args.clientOperationId,
    );
    if (replayed) return replayed;

    await assertCreditEnabled(ctx, organizationId);
    const customer = await ctx.db.get(args.customerId);
    assertOrgDoc(customer, organizationId);

    const amount = roundMoney(args.amount);
    const entries = await loadEntries(ctx, organizationId, args.customerId);
    const owed = customerBalance(entries);
    assertPaymentWithinBalance(owed, amount);

    const now = Date.now();
    const occurredAt =
      typeof args.paidAt === "number" && Number.isFinite(args.paidAt) && args.paidAt <= now
        ? args.paidAt
        : now;
    const entryId = await ctx.db.insert("customerLedgerEntries", {
      organizationId,
      customerId: args.customerId,
      type: "payment",
      amount: -amount,
      method: args.method,
      note: sanitizeOptionalText(args.note, "Note", TEXT_LIMITS.note),
      occurredAt,
      performedBy: userId,
    });
    const result = { entryId, balance: roundMoney(owed - amount) };

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "record_customer_payment",
      entityType: "customerLedgerEntries",
      entityId: entryId,
      organizationId,
      metadata: { customerId: args.customerId, amount, method: args.method },
    });
    await rememberClientOp(ctx, {
      organizationId,
      clientOperationId: args.clientOperationId,
      kind: "record_customer_payment",
      result,
    });
    return result;
  },
});

/** Organization-wide receivables: aging buckets plus the largest debtors. */
export const agingSummary = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const entries = await ctx.db
      .query("customerLedgerEntries")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const byCustomer = new Map<Id<"customers">, Doc<"customerLedgerEntries">[]>();
    for (const row of entries) {
      const bucket = byCustomer.get(row.customerId) ?? [];
      bucket.push(row);
      byCustomer.set(row.customerId, bucket);
    }
    const now = Date.now();
    const totals: AgingSummary = { current: 0, days31to60: 0, days61plus: 0, total: 0 };
    const debtors: Array<{ customerId: Id<"customers">; name: string; balance: number }> = [];
    for (const [customerId, rows] of byCustomer) {
      const aging = summarizeAging(rows, now);
      if (aging.total <= 0) continue;
      totals.current = roundMoney(totals.current + aging.current);
      totals.days31to60 = roundMoney(totals.days31to60 + aging.days31to60);
      totals.days61plus = roundMoney(totals.days61plus + aging.days61plus);
      totals.total = roundMoney(totals.total + aging.total);
      const customer = await ctx.db.get(customerId);
      if (!customer || customer.organizationId !== organizationId) continue;
      debtors.push({ customerId, name: customer.name, balance: customerBalance(rows) });
    }
    return {
      aging: totals,
      debtors: debtors.sort((a, b) => b.balance - a.balance).slice(0, 20),
    };
  },
});
