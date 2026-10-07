import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { requirePlatformAdmin } from "./shared/permissions";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  SMS_AUDIENCES,
  SMS_BROADCAST_MAX_RECIPIENTS,
  phonesForBroadcast,
  phonesForClockInAlert,
  smsAudienceValidator,
  type SmsAudience,
} from "./shared/smsAudience";

const broadcastArgs = {
  organizationId: v.optional(v.id("organizations")),
  audiences: v.array(smsAudienceValidator),
};

async function loadBroadcastRows(
  ctx: { db: import("./_generated/server").QueryCtx["db"] },
  organizationId: import("./_generated/dataModel").Id<"organizations"> | undefined,
) {
  const profiles = organizationId
    ? await ctx.db
        .query("profiles")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect()
    : await ctx.db.query("profiles").collect();
  const orgs = organizationId
    ? [await ctx.db.get(organizationId)].filter((org) => org !== null)
    : await ctx.db.query("organizations").collect();
  return {
    profiles: profiles.map((profile) => ({
      userId: String(profile.userId),
      role: profile.role,
      status: profile.status,
      phone: profile.phone ?? null,
    })),
    ownerUserIds: orgs.map((org) => String(org.ownerUserId)),
  };
}

export const preview = query({
  args: broadcastArgs,
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx, "sms.broadcast");
    const audiences = uniqueAudiences(args.audiences);
    if (audiences.length === 0) return { count: 0, capped: false };
    const rows = await loadBroadcastRows(ctx, args.organizationId);
    const phones = phonesForBroadcast({ ...rows, audiences });
    return {
      count: Math.min(phones.length, SMS_BROADCAST_MAX_RECIPIENTS),
      capped: phones.length > SMS_BROADCAST_MAX_RECIPIENTS,
    };
  },
});

export const listOrganizations = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx, "sms.broadcast");
    const orgs = await ctx.db.query("organizations").collect();
    return orgs
      .filter((org) => org.status === "active" || org.status === "trial")
      .map((org) => ({ id: org._id, name: org.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const listBroadcasts = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx, "sms.broadcast");
    const rows = await ctx.db.query("smsBroadcasts").withIndex("by_createdAt").order("desc").take(20);
    return rows.map((row) => ({
      id: row._id,
      createdAt: row.createdAt,
      audiences: row.audiences,
      message: row.message,
      recipientCount: row.recipientCount,
      status: row.status,
      detail: row.detail ?? null,
      organizationId: row.organizationId ?? null,
    }));
  },
});

export const broadcastPhones = internalQuery({
  args: broadcastArgs,
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx, "sms.broadcast");
    const audiences = uniqueAudiences(args.audiences);
    const rows = await loadBroadcastRows(ctx, args.organizationId);
    const phones = phonesForBroadcast({ ...rows, audiences });
    if (phones.length > SMS_BROADCAST_MAX_RECIPIENTS) {
      throw new Error(
        `That audience has ${phones.length} numbers. Choose one organization (limit ${SMS_BROADCAST_MAX_RECIPIENTS}).`,
      );
    }
    return phones;
  },
});

export const clockInAlert = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    cashierUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const organization = await ctx.db.get(args.organizationId);
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    return {
      timeZone: organization?.timezone ?? null,
      phones: phonesForClockInAlert({
        cashierUserId: String(args.cashierUserId),
        ownerUserId: organization ? String(organization.ownerUserId) : "",
        profiles: profiles.map((profile) => ({
          userId: String(profile.userId),
          role: profile.role,
          status: profile.status,
          phone: profile.phone ?? null,
        })),
      }),
    };
  },
});

export const recordBroadcast = internalMutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    audiences: v.array(smsAudienceValidator),
    message: v.string(),
    recipientCount: v.number(),
    status: v.union(v.literal("sent"), v.literal("skipped"), v.literal("failed")),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    await ctx.db.insert("smsBroadcasts", {
      createdAt: Date.now(),
      actorId: userId,
      organizationId: args.organizationId,
      audiences: uniqueAudiences(args.audiences),
      message: args.message,
      recipientCount: args.recipientCount,
      status: args.status,
      detail: args.detail,
    });
  },
});

function uniqueAudiences(values: SmsAudience[]) {
  return SMS_AUDIENCES.filter((audience) => values.includes(audience));
}
