/**
 * One-off platform finance repair: diagnose MRR/gross, abandon stale pendings,
 * mark test organizations, fix subscription recognized amounts, and hard-purge
 * a named organization.
 *
 * Internal-only — run via `npx convex run --prod repairs/platformFinance…`.
 */

import { v } from "convex/values";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import {
  indexLiveOffersByOrganization,
  subscriptionMrr,
} from "./shared/platformRevenue";

async function deleteByOrgIndex(
  ctx: MutationCtx,
  table: TableNames,
  organizationId: Id<"organizations">,
  indexName: string,
): Promise<number> {
  // Convex index builders are table-specific; cast once at the boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = ctx.db.query(table);
  const rows: Array<{ _id: Id<TableNames> }> = await q
    .withIndex(indexName, (idx: { eq: (field: string, value: unknown) => unknown }) =>
      idx.eq("organizationId", organizationId),
    )
    .collect();
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
  return rows.length;
}

async function deleteByOrgFieldScan(
  ctx: MutationCtx,
  table: TableNames,
  organizationId: Id<"organizations">,
): Promise<number> {
  const rows = await ctx.db.query(table).collect();
  let n = 0;
  for (const row of rows) {
    const r = row as { organizationId?: Id<"organizations">; _id: Id<TableNames> };
    if (r.organizationId === organizationId) {
      await ctx.db.delete(r._id);
      n += 1;
    }
  }
  return n;
}

export const diagnosePlatformFinance = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const [organizations, subscriptions, billing, offers] = await Promise.all([
      ctx.db.query("organizations").collect(),
      ctx.db.query("subscriptions").collect(),
      ctx.db.query("billingHistory").collect(),
      ctx.db.query("commercialOffers").collect(),
    ]);

    const liveOffersByOrg = indexLiveOffersByOrganization(offers, now);
    const latestSubByOrg = new Map<string, Doc<"subscriptions">>();
    for (const sub of subscriptions) {
      const key = String(sub.organizationId);
      const existing = latestSubByOrg.get(key);
      if (!existing || sub.updatedAt > existing.updatedAt) {
        latestSubByOrg.set(key, sub);
      }
    }

    const orgSummaries = organizations.map((org) => {
      const sub = org.subscriptionId
        ? subscriptions.find((s) => s._id === org.subscriptionId)
        : latestSubByOrg.get(String(org._id));
      const offer = liveOffersByOrg.get(String(org._id)) ?? null;
      const mrr = sub ? subscriptionMrr(sub, offer, now) : 0;
      const orgBilling = billing.filter((b) => b.organizationId === org._id);
      return {
        id: org._id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        planKey: org.planKey ?? null,
        isTestOrganization: org.isTestOrganization === true,
        subscription: sub
          ? {
              id: sub._id,
              status: sub.status,
              planKey: sub.planKey,
              billingCycle: sub.billingCycle,
              amount: sub.amount,
              isLifetime: sub.isLifetime,
              updatedAt: sub.updatedAt,
            }
          : null,
        offer: offer
          ? {
              status: offer.status,
              monthlyPrice: offer.monthlyPrice,
              yearlyPrice: offer.yearlyPrice,
            }
          : null,
        mrr,
        payments: orgBilling.map((b) => ({
          id: b._id,
          status: b.status,
          amount: b.amount,
          kind: b.kind ?? null,
          description: b.description,
          reference: b.reference,
          createdAt: b.createdAt,
          paidAt: b.paidAt ?? null,
          ageHours: Math.round((now - b.createdAt) / 3_600_000),
        })),
      };
    });

    const successAll = billing.filter((b) => b.status === "success");
    const pending = billing.filter((b) => b.status === "pending");
    let totalMrr = 0;
    for (const org of orgSummaries) {
      if (org.isTestOrganization) continue;
      totalMrr += org.mrr;
    }

    return {
      now,
      orgCount: organizations.length,
      totalMrr,
      arr: totalMrr * 12,
      grossAllTime: successAll.reduce((s, b) => s + b.amount, 0),
      successCount: successAll.length,
      pendingCount: pending.length,
      pendingTotal: pending.reduce((s, b) => s + b.amount, 0),
      pending: pending.map((b) => ({
        id: b._id,
        organizationId: b.organizationId,
        amount: b.amount,
        reference: b.reference,
        gateway: b.gateway,
        createdAt: b.createdAt,
        ageHours: Math.round((now - b.createdAt) / 3_600_000),
      })),
      organizations: orgSummaries,
    };
  },
});

/** Abandon every pending billingHistory row (stale checkouts). */
export const abandonAllPendingPayments = internalMutation({
  args: { olderThanHours: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const cutoffHours = args.olderThanHours ?? 0;
    const now = Date.now();
    const cutoff = now - cutoffHours * 3_600_000;
    const all = await ctx.db.query("billingHistory").collect();
    const targets = all.filter((row) => row.status === "pending" && row.createdAt <= cutoff);
    for (const row of targets) {
      await ctx.db.patch(row._id, { status: "abandoned", updatedAt: now });
    }
    return {
      abandoned: targets.length,
      amounts: targets.map((t) => ({
        id: t._id,
        amount: t.amount,
        reference: t.reference,
        organizationId: t.organizationId,
        gateway: t.gateway,
      })),
    };
  },
});

/** Mark named organizations as test (excluded from platform MRR/gross). */
export const markOrganizationsAsTest = internalMutation({
  args: {
    names: v.array(v.string()),
    isTest: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const isTest = args.isTest !== false;
    const needles = args.names.map((n) => n.trim().toLowerCase());
    const orgs = await ctx.db.query("organizations").collect();
    const matched: Array<{ id: Id<"organizations">; name: string; slug: string }> = [];
    for (const org of orgs) {
      const name = org.name.trim().toLowerCase();
      const slug = org.slug.trim().toLowerCase();
      if (
        needles.some(
          (n) => name === n || slug === n || name.includes(n) || slug.includes(n),
        )
      ) {
        await ctx.db.patch(org._id, {
          isTestOrganization: isTest,
          updatedAt: Date.now(),
        });
        matched.push({ id: org._id, name: org.name, slug: org.slug });
      }
    }
    return { matched, isTest };
  },
});

/**
 * Demote success billing rows that should not count as revenue (trial noise /
 * test charges). Gateway money is not reversed — platform metrics only.
 */
export const voidBillingSuccessRows = internalMutation({
  args: {
    billingIds: v.array(v.id("billingHistory")),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const voided: Array<{ id: Id<"billingHistory">; amount: number }> = [];
    for (const id of args.billingIds) {
      const row = await ctx.db.get(id);
      if (!row || row.status !== "success") continue;
      await ctx.db.patch(id, {
        status: "abandoned",
        updatedAt: now,
        metadata: JSON.stringify({
          ...(row.metadata ? safeJson(row.metadata) : {}),
          voidedFromSuccess: true,
          voidReason: args.reason,
          voidedAt: now,
        }),
      });
      voided.push({ id, amount: row.amount });
    }
    return { voided, reason: args.reason };
  },
});

/**
 * Align an active subscription's recognized amount/cycle with the real commercial
 * payment so MRR uses paid amount instead of catalog fallback.
 */
export const setSubscriptionRecognizedAmount = internalMutation({
  args: {
    organizationName: v.string(),
    amount: v.number(),
    billingCycle: v.union(v.literal("monthly"), v.literal("yearly"), v.literal("lifetime")),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("trialing"),
        v.literal("past_due"),
        v.literal("cancelled"),
        v.literal("expired"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const needle = args.organizationName.trim().toLowerCase();
    const orgs = await ctx.db.query("organizations").collect();
    const org = orgs.find(
      (o) =>
        o.name.trim().toLowerCase() === needle ||
        o.slug.trim().toLowerCase() === needle ||
        o.name.trim().toLowerCase().includes(needle),
    );
    if (!org) throw new Error(`Organization not found: ${args.organizationName}`);

    let sub: Doc<"subscriptions"> | null = null;
    if (org.subscriptionId) {
      sub = (await ctx.db.get(org.subscriptionId)) ?? null;
    }
    if (!sub) {
      const rows = await ctx.db
        .query("subscriptions")
        .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
        .collect();
      sub = rows.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
    }
    if (!sub) throw new Error(`No subscription for ${org.name}`);

    const patch: Partial<Doc<"subscriptions">> = {
      amount: args.amount,
      billingCycle: args.billingCycle,
      updatedAt: Date.now(),
    };
    if (args.status) patch.status = args.status;
    await ctx.db.patch(sub._id, patch);
    return {
      organizationId: org._id,
      organizationName: org.name,
      subscriptionId: sub._id,
      previous: { amount: sub.amount, billingCycle: sub.billingCycle, status: sub.status },
      next: {
        amount: args.amount,
        billingCycle: args.billingCycle,
        status: args.status ?? sub.status,
      },
    };
  },
});

/**
 * Hard-delete every business row for an organization, then the org itself.
 * Owner auth is removed only when they have no profile in another org.
 */
export const purgeOrganizationByName = internalMutation({
  args: {
    nameOrSlug: v.string(),
    confirmName: v.string(),
  },
  handler: async (ctx, args) => {
    const needle = args.nameOrSlug.trim().toLowerCase();
    const orgs = await ctx.db.query("organizations").collect();
    const org = orgs.find(
      (o) =>
        o.name.trim().toLowerCase() === needle ||
        o.slug.trim().toLowerCase() === needle ||
        o.slug.trim().toLowerCase().includes(needle) ||
        o.name.trim().toLowerCase().includes(needle),
    );
    if (!org) throw new Error(`Organization not found: ${args.nameOrSlug}`);
    if (args.confirmName.trim() !== org.name) {
      throw new Error(`confirmName must exactly match "${org.name}"`);
    }

    const organizationId = org._id;
    const deleted: Record<string, number> = {};

    // Capture member user ids before deleting profiles.
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const memberUserIds = new Set(profiles.map((p) => p.userId));
    memberUserIds.add(org.ownerUserId);

    const indexed: Array<{ table: TableNames; index: string }> = [
      { table: "commercialOffers", index: "by_organization" },
      { table: "subscriptions", index: "by_organization" },
      { table: "devices", index: "by_organization" },
      { table: "billingHistory", index: "by_organization" },
      { table: "cloudBackups", index: "by_organization" },
      { table: "branches", index: "by_organization" },
      { table: "categories", index: "by_organization" },
      { table: "products", index: "by_organization" },
      { table: "branchStock", index: "by_organization" },
      { table: "inventoryHistory", index: "by_organization" },
      { table: "inventoryLots", index: "by_organization" },
      { table: "stockTransfers", index: "by_organization" },
      { table: "suppliers", index: "by_organization" },
      { table: "supplierPurchases", index: "by_organization" },
      { table: "wholesaleStock", index: "by_organization" },
      { table: "wholesaleLots", index: "by_organization" },
      { table: "sales", index: "by_organization" },
      { table: "saleItems", index: "by_organization" },
      { table: "saleReturns", index: "by_organization" },
      { table: "saleReturnClientOps", index: "by_organization_clientOperationId" },
      { table: "mutationClientOps", index: "by_organization_clientOperationId" },
      { table: "expenses", index: "by_organization" },
      { table: "staffCompensation", index: "by_organization" },
      { table: "heldSales", index: "by_organization" },
      { table: "customers", index: "by_organization" },
      { table: "saleClientOps", index: "by_organization_clientOperationId" },
      { table: "settings", index: "by_organization_key" },
      { table: "importJobs", index: "by_organization_createdAt" },
      { table: "importMappings", index: "by_organization_kind" },
      { table: "exportEvents", index: "by_organization_createdAt" },
      { table: "auditLogs", index: "by_organization" },
      { table: "platformEvents", index: "by_organization_occurredAt" },
      { table: "platformDailyActiveUsers", index: "by_organization_day" },
      { table: "organizationPlatformStats", index: "by_organization" },
      { table: "platformTelemetryHeartbeats", index: "by_organization" },
      { table: "storageUploadSessions", index: "by_organization_createdAt" },
      { table: "pushDevices", index: "by_organization" },
      { table: "profiles", index: "by_organization" },
    ];

    for (const { table, index } of indexed) {
      try {
        deleted[table] = await deleteByOrgIndex(ctx, table, organizationId, index);
      } catch (err) {
        console.error(`purge indexed fail ${table}`, err);
        deleted[table] = await deleteByOrgFieldScan(ctx, table, organizationId);
      }
    }

    // Tables with organizationId but no dedicated by_organization index.
    for (const table of [
      "supplierPurchaseItems",
      "saleItemLots",
      "saleReturnItems",
      "saleReturnItemLots",
      "receipts",
      "userTourProgress",
      "pushOutbox",
    ] as TableNames[]) {
      deleted[table] = await deleteByOrgFieldScan(ctx, table, organizationId);
    }

    // Remove users that no longer belong to any organization.
    const remainingProfiles = await ctx.db.query("profiles").collect();
    const usersInOtherOrgs = new Set(remainingProfiles.map((p) => String(p.userId)));
    let usersDeleted = 0;
    let accountsDeleted = 0;
    let sessionsDeleted = 0;
    for (const userId of memberUserIds) {
      if (usersInOtherOrgs.has(String(userId))) continue;
      const accounts = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
        .collect();
      for (const account of accounts) {
        await ctx.db.delete(account._id);
        accountsDeleted += 1;
      }
      const sessions = await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect();
      for (const session of sessions) {
        const refresh = await ctx.db
          .query("authRefreshTokens")
          .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
          .collect();
        for (const token of refresh) {
          await ctx.db.delete(token._id);
        }
        await ctx.db.delete(session._id);
        sessionsDeleted += 1;
      }
      await ctx.db.delete(userId);
      usersDeleted += 1;
    }
    deleted.users = usersDeleted;
    deleted.authAccounts = accountsDeleted;
    deleted.authSessions = sessionsDeleted;

    await ctx.db.delete(organizationId);
    deleted.organizations = 1;

    return {
      purged: org.name,
      slug: org.slug,
      organizationId,
      deleted,
    };
  },
});

function safeJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
