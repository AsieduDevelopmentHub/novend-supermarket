import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { requirePlatformAdmin } from "./shared/permissions";
import { recomputeOrgPlatformStats } from "./shared/organizationStats";

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
    await requirePlatformAdmin(ctx);
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
    await requirePlatformAdmin(ctx);
    return await recomputeOrgPlatformStats(ctx, args.organizationId);
  },
});
