/**
 * Per-organization counters for Super Admin platform screens.
 * Avoids unbounded `.collect()` on sales/products across the whole deployment.
 */

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { recordTelemetryRollups } from "./platformTelemetry";

type Ctx = QueryCtx | MutationCtx;

export type OrganizationPlatformStats = {
  organizationId: Id<"organizations">;
  saleCount: number;
  saleRevenueTotal: number;
  productCount: number;
  userCount: number;
  branchCount: number;
  importJobCount: number;
  failedImportCount: number;
  exportEventCount: number;
  updatedAt: number;
};

const EMPTY = {
  saleCount: 0,
  saleRevenueTotal: 0,
  productCount: 0,
  userCount: 0,
  branchCount: 0,
  importJobCount: 0,
  failedImportCount: 0,
  exportEventCount: 0,
} as const;

function fromDoc(row: Doc<"organizationPlatformStats">): OrganizationPlatformStats {
  return {
    organizationId: row.organizationId,
    saleCount: row.saleCount,
    saleRevenueTotal: row.saleRevenueTotal,
    productCount: row.productCount,
    userCount: row.userCount,
    branchCount: row.branchCount,
    importJobCount: row.importJobCount,
    failedImportCount: row.failedImportCount,
    exportEventCount: row.exportEventCount,
    updatedAt: row.updatedAt,
  };
}

export async function readOrgPlatformStats(
  ctx: Ctx,
  organizationId: Id<"organizations">,
): Promise<OrganizationPlatformStats | null> {
  const row = await ctx.db
    .query("organizationPlatformStats")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .unique();
  return row ? fromDoc(row) : null;
}

export async function readOrgPlatformStatsOrZero(
  ctx: Ctx,
  organizationId: Id<"organizations">,
): Promise<OrganizationPlatformStats> {
  const row = await readOrgPlatformStats(ctx, organizationId);
  if (row) return row;
  return { organizationId, ...EMPTY, updatedAt: 0 };
}

async function computeOrgPlatformStats(
  ctx: Ctx,
  organizationId: Id<"organizations">,
): Promise<Omit<OrganizationPlatformStats, "organizationId" | "updatedAt">> {
  const [sales, products, profiles, branches, importJobs, exportEvents] = await Promise.all([
    ctx.db
      .query("sales")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect(),
    ctx.db
      .query("products")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect(),
    ctx.db
      .query("profiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect(),
    ctx.db
      .query("branches")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect(),
    ctx.db
      .query("importJobs")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect(),
    ctx.db
      .query("exportEvents")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect(),
  ]);

  return {
    saleCount: sales.length,
    saleRevenueTotal: sales.reduce((sum, sale) => sum + sale.total, 0),
    productCount: products.filter((product) => product.status !== "archived").length,
    userCount: profiles.length,
    branchCount: branches.length,
    importJobCount: importJobs.length,
    failedImportCount: importJobs.filter((job) => job.status === "failed").length,
    exportEventCount: exportEvents.length,
  };
}

/** Full recompute for one org (backfill / repair). Mutation-only. */
export async function recomputeOrgPlatformStats(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<OrganizationPlatformStats> {
  const computed = await computeOrgPlatformStats(ctx, organizationId);
  const now = Date.now();
  const existing = await ctx.db
    .query("organizationPlatformStats")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { ...computed, updatedAt: now });
  } else {
    await ctx.db.insert("organizationPlatformStats", {
      organizationId,
      ...computed,
      updatedAt: now,
    });
  }
  return { organizationId, ...computed, updatedAt: now };
}

async function loadStatsDoc(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<Doc<"organizationPlatformStats"> | null> {
  return await ctx.db
    .query("organizationPlatformStats")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .unique();
}

/** Ensure a row exists; recomputes once when missing so increments stay accurate. */
async function ensureStatsDoc(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<Doc<"organizationPlatformStats">> {
  const existing = await loadStatsDoc(ctx, organizationId);
  if (existing) return existing;
  await recomputeOrgPlatformStats(ctx, organizationId);
  const created = await loadStatsDoc(ctx, organizationId);
  if (!created) {
    throw new Error("Failed to create organization platform stats");
  }
  return created;
}

export async function seedOrgPlatformStats(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  seed: Partial<Omit<OrganizationPlatformStats, "organizationId" | "updatedAt">> = {},
) {
  const existing = await loadStatsDoc(ctx, organizationId);
  if (existing) return;
  await ctx.db.insert("organizationPlatformStats", {
    organizationId,
    ...EMPTY,
    ...seed,
    updatedAt: Date.now(),
  });
}

export async function bumpOrgSaleStats(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  args: { revenue: number; completedAt: number },
) {
  const doc = await ensureStatsDoc(ctx, organizationId);
  await ctx.db.patch(doc._id, {
    saleCount: doc.saleCount + 1,
    saleRevenueTotal: doc.saleRevenueTotal + args.revenue,
    updatedAt: Date.now(),
  });
  await recordTelemetryRollups(ctx, {
    occurredAt: args.completedAt,
    metric: "sale_completed",
    count: 1,
  });
}

export async function bumpOrgProductCount(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  delta: number,
) {
  if (delta === 0) return;
  const doc = await ensureStatsDoc(ctx, organizationId);
  await ctx.db.patch(doc._id, {
    productCount: Math.max(0, doc.productCount + delta),
    updatedAt: Date.now(),
  });
}

export async function bumpOrgUserCount(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  delta: number,
) {
  if (delta === 0) return;
  const doc = await ensureStatsDoc(ctx, organizationId);
  await ctx.db.patch(doc._id, {
    userCount: Math.max(0, doc.userCount + delta),
    updatedAt: Date.now(),
  });
}

export async function bumpOrgBranchCount(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  delta: number,
) {
  if (delta === 0) return;
  const doc = await ensureStatsDoc(ctx, organizationId);
  await ctx.db.patch(doc._id, {
    branchCount: Math.max(0, doc.branchCount + delta),
    updatedAt: Date.now(),
  });
}

export async function bumpOrgImportJobStats(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  args: { failed?: boolean },
) {
  const doc = await ensureStatsDoc(ctx, organizationId);
  await ctx.db.patch(doc._id, {
    importJobCount: doc.importJobCount + 1,
    failedImportCount: args.failed ? doc.failedImportCount + 1 : doc.failedImportCount,
    updatedAt: Date.now(),
  });
}

export async function bumpOrgExportEventCount(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  const doc = await ensureStatsDoc(ctx, organizationId);
  await ctx.db.patch(doc._id, {
    exportEventCount: doc.exportEventCount + 1,
    updatedAt: Date.now(),
  });
}

/** Counts toward plan/product usage (matches prior platform list semantics). */
export function productCountsTowardUsage(status: string): boolean {
  return status !== "archived";
}
