import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getProfileByUserId, requireSessionIgnoringLicense } from "./shared/permissions";
import {
  DEFAULT_NOTIFICATION_TOPICS,
  mergeTopicPrefs,
  type NotificationTopic,
  type NotificationTopicPrefs,
} from "./shared/notificationTopics";

const platformValidator = v.union(
  v.literal("web"),
  v.literal("capacitor"),
  v.literal("electron"),
);

const topicValidator = v.union(
  v.literal("stock_alerts"),
  v.literal("daily_summary"),
  v.literal("branch_transfers"),
  v.literal("subscription_alerts"),
);

const topicsObjectValidator = v.object({
  stock_alerts: v.boolean(),
  daily_summary: v.boolean(),
  branch_transfers: v.boolean(),
  subscription_alerts: v.boolean(),
});

/** Register or refresh a push endpoint for the signed-in user. */
export const registerDevice = mutation({
  args: {
    platform: platformValidator,
    endpoint: v.string(),
    p256dh: v.optional(v.string()),
    auth: v.optional(v.string()),
    topics: v.optional(topicsObjectValidator),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireSessionIgnoringLicense(ctx);
    const endpoint = args.endpoint.trim();
    if (!endpoint) throw new Error("Push endpoint is required.");
    if (args.platform === "web" && (!args.p256dh || !args.auth)) {
      throw new Error("Web Push requires subscription keys.");
    }

    const now = Date.now();
    const topics = mergeTopicPrefs(args.topics);
    const existing = await ctx.db
      .query("pushDevices")
      .withIndex("by_user_endpoint", (q) =>
        q.eq("userId", session.userId).eq("endpoint", endpoint),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        platform: args.platform,
        p256dh: args.p256dh,
        auth: args.auth,
        topics,
        userAgent: args.userAgent,
        organizationId: session.organizationId,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("pushDevices", {
      organizationId: session.organizationId,
      userId: session.userId,
      platform: args.platform,
      endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      topics,
      userAgent: args.userAgent,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const unregisterDevice = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const session = await requireSessionIgnoringLicense(ctx);
    const existing = await ctx.db
      .query("pushDevices")
      .withIndex("by_user_endpoint", (q) =>
        q.eq("userId", session.userId).eq("endpoint", args.endpoint.trim()),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const updateTopicPrefs = mutation({
  args: { topics: topicsObjectValidator },
  handler: async (ctx, args) => {
    const session = await requireSessionIgnoringLicense(ctx);
    const devices = await ctx.db
      .query("pushDevices")
      .withIndex("by_user", (q) => q.eq("userId", session.userId))
      .collect();
    const topics = mergeTopicPrefs(args.topics);
    const now = Date.now();
    for (const device of devices) {
      await ctx.db.patch(device._id, { topics, updatedAt: now });
    }
    return topics;
  },
});

export const myDevices = query({
  args: {},
  handler: async (ctx) => {
    const session = await requireSessionIgnoringLicense(ctx);
    return await ctx.db
      .query("pushDevices")
      .withIndex("by_user", (q) => q.eq("userId", session.userId))
      .collect();
  },
});

/** Electron foreground outbox — unconsumed rows for this user. */
export const listMyOutbox = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    try {
      const session = await requireSessionIgnoringLicense(ctx);
      const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
      const rows = await ctx.db
        .query("pushOutbox")
        .withIndex("by_user_createdAt", (q) => q.eq("userId", session.userId))
        .order("desc")
        .take(limit * 3);
      return rows.filter((row) => row.consumedAt === undefined).slice(0, limit);
    } catch {
      // Never fail the shell for push outbox — auth/table races on cold login.
      return [];
    }
  },
});

export const ackOutbox = mutation({
  args: { ids: v.array(v.id("pushOutbox")) },
  handler: async (ctx, args) => {
    const session = await requireSessionIgnoringLicense(ctx);
    const now = Date.now();
    for (const id of args.ids) {
      const row = await ctx.db.get(id);
      if (!row || row.userId !== session.userId) continue;
      if (row.consumedAt !== undefined) continue;
      await ctx.db.patch(id, { consumedAt: now });
    }
  },
});

export const devicesForDispatch = internalQuery({
  args: {
    organizationId: v.optional(v.id("organizations")),
    userId: v.optional(v.id("users")),
    topic: topicValidator,
  },
  handler: async (ctx, args) => {
    let devices;
    if (args.userId) {
      devices = await ctx.db
        .query("pushDevices")
        .withIndex("by_user", (q) => q.eq("userId", args.userId!))
        .collect();
    } else if (args.organizationId) {
      devices = await ctx.db
        .query("pushDevices")
        .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId!))
        .collect();
    } else {
      return [];
    }
    const muted = new Set<string>();
    const seen = new Set<string>();
    for (const device of devices) {
      const userKey = String(device.userId);
      if (seen.has(userKey)) continue;
      seen.add(userKey);
      const profile = await getProfileByUserId(ctx, device.userId);
      if (profile?.notificationsMuted === true) muted.add(userKey);
    }
    return devices.filter(
      (device) =>
        device.topics[args.topic as NotificationTopic] === true &&
        !muted.has(String(device.userId)),
    );
  },
});

export const enqueueElectronOutbox = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    topic: topicValidator,
    title: v.string(),
    body: v.string(),
    dataJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("pushOutbox", {
      organizationId: args.organizationId,
      userId: args.userId,
      topic: args.topic,
      title: args.title,
      body: args.body,
      dataJson: args.dataJson,
      createdAt: Date.now(),
    });
  },
});

export const removeDeviceByEndpoint = internalMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("pushDevices")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .collect();
    for (const device of matches) {
      await ctx.db.delete(device._id);
    }
  },
});

export const purgeConsumedOutbox = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const rows = await ctx.db.query("pushOutbox").take(200);
    let deleted = 0;
    for (const row of rows) {
      if (row.consumedAt !== undefined && row.consumedAt < cutoff) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
    }
    return { deleted };
  },
});

export { DEFAULT_NOTIFICATION_TOPICS };
export type { NotificationTopicPrefs };
