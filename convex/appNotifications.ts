import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireSessionIgnoringLicense } from "./shared/permissions";
import { roleReceivesClockIn, roleReceivesTopic } from "./shared/notificationAudience";
import type { NotificationTopic } from "./shared/notificationTopics";

const LIST_LIMIT = 40;

export const mine = query({
  args: {},
  handler: async (ctx) => {
    try {
      const session = await requireSessionIgnoringLicense(ctx);
      const rows = await ctx.db
        .query("appNotifications")
        .withIndex("by_user_createdAt", (q) => q.eq("userId", session.userId))
        .order("desc")
        .take(80);
      const visible = rows.filter((row) => row.clearedAt === undefined).slice(0, LIST_LIMIT);
      return {
        muted: session.profile.notificationsMuted === true,
        unread: visible.filter((row) => row.readAt === undefined).length,
        items: visible.map((row) => ({
          id: row._id,
          topic: row.topic,
          title: row.title,
          body: row.body,
          href: row.href ?? null,
          createdAt: row.createdAt,
          read: row.readAt !== undefined,
        })),
      };
    } catch {
      return { muted: false, unread: 0, items: [] as const };
    }
  },
});

export const markRead = mutation({
  args: { id: v.id("appNotifications") },
  handler: async (ctx, args) => {
    const session = await requireSessionIgnoringLicense(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== session.userId || row.organizationId !== session.organizationId) {
      return;
    }
    if (row.readAt === undefined) {
      await ctx.db.patch(row._id, { readAt: Date.now() });
    }
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const session = await requireSessionIgnoringLicense(ctx);
    const rows = await ctx.db
      .query("appNotifications")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", session.userId))
      .order("desc")
      .take(80);
    const now = Date.now();
    for (const row of rows) {
      if (row.clearedAt !== undefined || row.readAt !== undefined) continue;
      if (row.organizationId !== session.organizationId) continue;
      await ctx.db.patch(row._id, { readAt: now });
    }
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const session = await requireSessionIgnoringLicense(ctx);
    const rows = await ctx.db
      .query("appNotifications")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", session.userId))
      .order("desc")
      .take(80);
    const now = Date.now();
    for (const row of rows) {
      if (row.clearedAt !== undefined) continue;
      if (row.organizationId !== session.organizationId) continue;
      await ctx.db.patch(row._id, { clearedAt: now, readAt: row.readAt ?? now });
    }
  },
});

export const setMuted = mutation({
  args: { muted: v.boolean() },
  handler: async (ctx, args) => {
    const session = await requireSessionIgnoringLicense(ctx);
    await ctx.db.patch(session.profile._id, { notificationsMuted: args.muted });
    return { muted: args.muted };
  },
});

/** Inbox copy of an existing push dispatch. Does not change device delivery. */
export const recordFromDispatch = internalMutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    userId: v.optional(v.id("users")),
    topic: v.union(
      v.literal("stock_alerts"),
      v.literal("daily_summary"),
      v.literal("branch_transfers"),
      v.literal("subscription_alerts"),
    ),
    title: v.string(),
    body: v.string(),
    href: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const topic = args.topic as NotificationTopic;
    const profiles = await profilesFor(ctx, args.organizationId, args.userId);
    const now = Date.now();
    let written = 0;
    for (const profile of profiles) {
      if (profile.notificationsMuted === true) continue;
      if (profile.status !== "active") continue;
      if (!roleReceivesTopic(profile.role, topic)) continue;
      await ctx.db.insert("appNotifications", {
        organizationId: profile.organizationId,
        userId: profile.userId,
        topic,
        title: args.title.slice(0, 120),
        body: args.body.slice(0, 280),
        href: args.href?.startsWith("/") ? args.href.slice(0, 200) : undefined,
        createdAt: now,
      });
      written += 1;
      if (written >= 100) break;
    }
    return { written };
  },
});

/** One welcome row for the person who just joined. */
export const recordWelcome = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    organizationName: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!profile || profile.organizationId !== args.organizationId) return;
    if (profile.notificationsMuted === true || profile.status !== "active") return;
    const organization = args.organizationName.trim() || "Your business";
    await ctx.db.insert("appNotifications", {
      organizationId: args.organizationId,
      userId: args.userId,
      topic: "welcome",
      title: "Welcome to Novend",
      body: `${organization} is ready. You can sell from this till, online or offline.`.slice(0, 280),
      href: "/dashboard",
      createdAt: Date.now(),
    });
  },
});

/** One inbox row per supervising admin/manager. Not sent to the cashier. */
export const recordClockIn = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    cashierUserId: v.id("users"),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    const now = Date.now();
    for (const profile of profiles) {
      if (profile.userId === args.cashierUserId) continue;
      if (profile.notificationsMuted === true || profile.status !== "active") continue;
      if (!roleReceivesClockIn(profile.role)) continue;
      await ctx.db.insert("appNotifications", {
        organizationId: args.organizationId,
        userId: profile.userId,
        topic: "staff_clock_in",
        title: args.title.slice(0, 120),
        body: args.body.slice(0, 280),
        href: "/users",
        createdAt: now,
      });
    }
  },
});

async function profilesFor(
  ctx: { db: import("./_generated/server").QueryCtx["db"] },
  organizationId: Id<"organizations"> | undefined,
  userId: Id<"users"> | undefined,
) {
  if (userId) {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) return [];
    if (organizationId && profile.organizationId !== organizationId) return [];
    return [profile];
  }
  if (!organizationId) return [];
  return await ctx.db
    .query("profiles")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();
}
