import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requirePlatformAdmin } from "./shared/permissions";
import { recomputeOrgPlatformStats } from "./shared/organizationStats";
import { writeAuditLog } from "./shared/audit";
import { readPlatformStats, rebuildPlatformStats } from "./shared/platformStatsAggregate";

/**
 * Backfill / repair organizationPlatformStats in batches.
 * Platform admin can run after deploy; internal for scheduled repair.
 */
export const backfillBatch = internalMutation({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("organizations").paginate(args.paginationOpts);
    for (const org of page.page) {
      await recomputeOrgPlatformStats(ctx, org._id);
    }
    return {
      isDone: page.isDone,
      continueCursor: page.continueCursor,
      processed: page.page.length,
    };
  },
});

export const backfillOrganizationStats = mutation({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx, "analytics.read");
    const page = await ctx.db.query("organizations").paginate(args.paginationOpts);
    for (const org of page.page) {
      await recomputeOrgPlatformStats(ctx, org._id);
    }
    return {
      isDone: page.isDone,
      continueCursor: page.continueCursor,
      processed: page.page.length,
    };
  },
});

export const recomputeOne = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx, "analytics.read");
    return await recomputeOrgPlatformStats(ctx, args.organizationId);
  },
});

/**
 * Deployment-wide platform aggregate (`platformStats` singleton).
 *
 * `getGlobal` reads the singleton for overview KPI cards without scanning every
 * organization; `rebuild` repairs it from a single full scan.
 * See docs/architecture/CLOUD_MODE_PLAN_V2.md (§11–§12, §40).
 */
export const getGlobal = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx, "analytics.read");
    return await readPlatformStats(ctx);
  },
});

export const rebuild = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requirePlatformAdmin(ctx, "analytics.read");
    const stats = await rebuildPlatformStats(ctx);
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "platform_stats_rebuilt",
      entityType: "platformStats",
      metadata: {
        organizationCount: stats.organizationCount,
        activeOrganizationCount: stats.activeOrganizationCount,
      },
    });
    return stats;
  },
});
