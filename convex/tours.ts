import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getPlatformAdmin, getProfileByUserId, requireAuth } from "./shared/permissions";
import { tourStatusValidator } from "./schema";

const TOUR_IDS = [
  "shell",
  "sales",
  "products",
  "inventory",
  "reports",
  "users",
  "settings",
  "platform",
] as const;

function requireTourId(value: string) {
  const tourId = value.trim().toLowerCase();
  if (!(TOUR_IDS as readonly string[]).includes(tourId)) {
    throw new Error("Unknown product tour");
  }
  return tourId;
}

export const listOwn = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    const rows = await ctx.db
      .query("userTourProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.map((row) => ({
      tourId: row.tourId,
      version: row.version,
      status: row.status,
      lastStepId: row.lastStepId ?? null,
      startedAt: row.startedAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt ?? null,
    }));
  },
});

export const saveOwn = mutation({
  args: {
    tourId: v.string(),
    version: v.number(),
    status: tourStatusValidator,
    lastStepId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const [profile, platformAdmin] = await Promise.all([
      getProfileByUserId(ctx, userId),
      getPlatformAdmin(ctx, userId),
    ]);
    if ((!profile || profile.status !== "active") && !platformAdmin) throw new Error("Forbidden");
    const tourId = requireTourId(args.tourId);
    const version = Math.min(Math.max(Math.trunc(args.version), 1), 1000);
    const lastStepId = args.lastStepId?.trim().slice(0, 80);
    const now = Date.now();
    const existing = await ctx.db
      .query("userTourProgress")
      .withIndex("by_user_tour", (q) => q.eq("userId", userId).eq("tourId", tourId))
      .unique();
    const values = {
      organizationId: profile?.organizationId,
      version,
      status: args.status,
      lastStepId,
      updatedAt: now,
      completedAt: args.status === "completed" ? now : undefined,
    };
    if (existing) {
      await ctx.db.patch(existing._id, values);
      return existing._id;
    }
    return await ctx.db.insert("userTourProgress", {
      userId,
      tourId,
      startedAt: now,
      ...values,
    });
  },
});

export const restartOwn = mutation({
  args: { tourId: v.string(), version: v.number() },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const tourId = requireTourId(args.tourId);
    const existing = await ctx.db
      .query("userTourProgress")
      .withIndex("by_user_tour", (q) => q.eq("userId", userId).eq("tourId", tourId))
      .unique();
    if (!existing) return null;
    await ctx.db.patch(existing._id, {
      version: Math.min(Math.max(Math.trunc(args.version), 1), 1000),
      status: "in_progress",
      lastStepId: undefined,
      completedAt: undefined,
      updatedAt: Date.now(),
    });
    return existing._id;
  },
});
