import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requirePlatformAdmin } from "./shared/permissions";
import {
  NOTICE_BODY_MAX,
  NOTICE_BROADCAST_MAX_RECIPIENTS,
  NOTICE_TITLE_MAX,
  SMS_AUDIENCES,
  recipientsForNotice,
  smsAudienceValidator,
  type SmsAudience,
} from "./shared/smsAudience";

const audienceArgs = {
  organizationId: v.optional(v.id("organizations")),
  audiences: v.array(smsAudienceValidator),
};

async function loadNoticeRows(
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
      userId: profile.userId,
      organizationId: profile.organizationId,
      role: profile.role,
      status: profile.status,
      muted: profile.notificationsMuted === true,
    })),
    ownerUserIds: orgs.map((org) => String(org.ownerUserId)),
  };
}

function uniqueAudiences(values: SmsAudience[]) {
  return SMS_AUDIENCES.filter((audience) => values.includes(audience));
}

export const preview = query({
  args: audienceArgs,
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx, "sms.broadcast");
    const audiences = uniqueAudiences(args.audiences);
    if (audiences.length === 0) return { count: 0, capped: false };
    const rows = await loadNoticeRows(ctx, args.organizationId);
    const recipients = recipientsForNotice({
      audiences,
      profiles: rows.profiles.map((profile) => ({
        ...profile,
        userId: String(profile.userId),
        organizationId: String(profile.organizationId),
      })),
      ownerUserIds: rows.ownerUserIds,
    });
    return {
      count: Math.min(recipients.length, NOTICE_BROADCAST_MAX_RECIPIENTS),
      capped: recipients.length > NOTICE_BROADCAST_MAX_RECIPIENTS,
    };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx, "sms.broadcast");
    const rows = await ctx.db.query("platformNotices").withIndex("by_createdAt").order("desc").take(20);
    return rows.map((row) => ({
      id: row._id,
      createdAt: row.createdAt,
      audiences: row.audiences,
      title: row.title,
      body: row.body,
      recipientCount: row.recipientCount,
      organizationId: row.organizationId ?? null,
    }));
  },
});

export const send = mutation({
  args: {
    ...audienceArgs,
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx, "sms.broadcast");
    const actorId = await getAuthUserId(ctx);
    if (!actorId) throw new Error("Unauthenticated");
    const title = args.title.trim().slice(0, NOTICE_TITLE_MAX);
    const body = args.body.trim().slice(0, NOTICE_BODY_MAX);
    if (!title || !body) throw new Error("Write a title and a message.");
    const audiences = uniqueAudiences(args.audiences);
    if (audiences.length === 0) throw new Error("Choose at least one group.");
    const rows = await loadNoticeRows(ctx, args.organizationId);
    const wanted = recipientsForNotice({
      audiences,
      profiles: rows.profiles.map((profile) => ({
        ...profile,
        userId: String(profile.userId),
        organizationId: String(profile.organizationId),
      })),
      ownerUserIds: rows.ownerUserIds,
    });
    if (wanted.length > NOTICE_BROADCAST_MAX_RECIPIENTS) {
      throw new Error(
        `That audience has ${wanted.length} people. Choose one organization (limit ${NOTICE_BROADCAST_MAX_RECIPIENTS}).`,
      );
    }
    if (wanted.length === 0) throw new Error("No one in that audience will see this notice.");
    const byUser = new Map(rows.profiles.map((profile) => [String(profile.userId), profile]));
    const now = Date.now();
    for (const recipient of wanted) {
      const profile = byUser.get(recipient.userId);
      if (!profile) continue;
      await ctx.db.insert("appNotifications", {
        organizationId: profile.organizationId,
        userId: profile.userId,
        topic: "platform_notice",
        title,
        body,
        createdAt: now,
      });
    }
    await ctx.db.insert("platformNotices", {
      createdAt: now,
      actorId,
      organizationId: args.organizationId,
      audiences,
      title,
      body,
      recipientCount: wanted.length,
    });
    return { recipientCount: wanted.length };
  },
});
