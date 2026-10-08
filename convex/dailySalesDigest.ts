import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { businessTimeZone } from "./shared/businessDate";
import {
  addReturn,
  addSale,
  businessDayRange,
  dailySalesInbox,
  dailySalesSms,
  emptyDailySales,
  reportDateKey,
  type DailySalesFigures,
} from "./shared/dailySalesReport";
import { normalizeSmsRecipient, sendArkeselSms } from "./shared/arkeselSms";
import { publicAppUrl } from "./shared/transactionalEmail";
import { collectSalesInCompletedAtRange } from "./shared/salesRange";

type PreparedDailySales = {
  organizationId: Id<"organizations">;
  organizationName: string;
  currency: string;
  dateKey: string;
  figures: DailySalesFigures;
  userIds: Array<Id<"users">>;
  phones: string[];
};

type DailySalesSendResult = { sent: false } | { sent: true; dateKey: string };

export const prepare = internalQuery({
  args: { organizationId: v.id("organizations"), now: v.number() },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org || org.status === "disabled" || org.status === "inactive") return null;
    const timeZone = businessTimeZone(org.timezone);
    const dateKey = reportDateKey(args.now, timeZone);
    const already = await ctx.db
      .query("dailySalesDigests")
      .withIndex("by_organization_date", (q) =>
        q.eq("organizationId", org._id).eq("dateKey", dateKey),
      )
      .unique();
    if (already) return null;

    const { start, end } = businessDayRange(dateKey, timeZone);
    const sales = await collectSalesInCompletedAtRange(ctx, org._id, start, end - 1);
    let figures: DailySalesFigures = emptyDailySales();
    for (const sale of sales) {
      figures = addSale(figures, sale);
    }

    const returns = await ctx.db
      .query("saleReturns")
      .withIndex("by_organization_completedAt", (q) =>
        q
          .eq("organizationId", org._id)
          .gte("completedAt", start)
          .lte("completedAt", end - 1),
      )
      .take(2000);
    for (const row of returns) {
      figures = addReturn(figures, row);
    }

    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .take(200);
    const administrators = profiles.filter(
      (profile) =>
        profile.role === "administrator" &&
        profile.status === "active" &&
        profile.notificationsMuted !== true,
    );

    return {
      organizationId: org._id,
      organizationName: org.name,
      currency: org.currency,
      dateKey,
      figures,
      userIds: administrators.map((profile) => profile.userId),
      phones: [
        ...new Set(
          administrators
            .map((profile) =>
              profile.phone ? normalizeSmsRecipient(profile.phone) : null,
            )
            .filter((phone): phone is string => Boolean(phone)),
        ),
      ],
    };
  },
});

export const claim = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    dateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dailySalesDigests")
      .withIndex("by_organization_date", (q) =>
        q.eq("organizationId", args.organizationId).eq("dateKey", args.dateKey),
      )
      .unique();
    if (existing) return false;
    await ctx.db.insert("dailySalesDigests", {
      organizationId: args.organizationId,
      dateKey: args.dateKey,
      sentAt: Date.now(),
    });
    return true;
  },
});

export const publishInbox = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userIds: v.array(v.id("users")),
    dateKey: v.string(),
    title: v.string(),
    body: v.string(),
    href: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const userId of args.userIds) {
      await ctx.db.insert("appNotifications", {
        organizationId: args.organizationId,
        userId,
        topic: "daily_summary",
        title: args.title,
        body: args.body,
        href: args.href,
        createdAt: now,
      });
    }
  },
});

export const sendForOrganization = internalAction({
  args: { organizationId: v.id("organizations"), now: v.optional(v.number()) },
  handler: async (ctx, args): Promise<DailySalesSendResult> => {
    const now = args.now ?? Date.now();
    // Explicit types break a cycle: this action calls other functions in the
    // same module, and Convex's generated `internal` types point back here.
    const prepared: PreparedDailySales | null = await ctx.runQuery(
      internal.dailySalesDigest.prepare,
      {
        organizationId: args.organizationId,
        now,
      },
    );
    if (!prepared) return { sent: false };

    const claimed: boolean = await ctx.runMutation(internal.dailySalesDigest.claim, {
      organizationId: prepared.organizationId,
      dateKey: prepared.dateKey,
    });
    if (!claimed) return { sent: false };

    const copy = {
      organizationName: prepared.organizationName,
      dateKey: prepared.dateKey,
      currency: prepared.currency,
      figures: prepared.figures,
    };
    const inbox = dailySalesInbox(copy);
    if (prepared.userIds.length > 0) {
      await ctx.runMutation(internal.dailySalesDigest.publishInbox, {
        organizationId: prepared.organizationId,
        userIds: prepared.userIds,
        dateKey: prepared.dateKey,
        title: inbox.title,
        body: inbox.body,
        href: inbox.href,
      });
    }

    const text = dailySalesSms({ ...copy, reportsUrl: `${publicAppUrl()}/reports` });
    for (const phone of prepared.phones) {
      await sendArkeselSms({ to: phone, message: text });
    }
    for (const userId of prepared.userIds) {
      await ctx.runAction(internal.pushDispatch.dispatchPush, {
        organizationId: prepared.organizationId,
        userId,
        topic: "daily_summary",
        title: inbox.title,
        body: inbox.body,
        data: { href: inbox.href },
        skipInbox: true,
      });
    }
    return { sent: true, dateKey: prepared.dateKey };
  },
});

export const runDailySalesReports = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const orgs = await ctx.runQuery(internal.pushAlerts.listActiveOrganizations, {});
    const now = Date.now();
    for (const org of orgs) {
      await ctx.runAction(internal.dailySalesDigest.sendForOrganization, {
        organizationId: org._id,
        now,
      });
    }
  },
});
