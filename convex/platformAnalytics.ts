import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlatformAdmin } from "./shared/permissions";
import { PLAN_CATALOG, resolvePlan, type PlanKey } from "./shared/plans";
import { platformCostCategoryValidator } from "./schema";
import { sanitizeText } from "./shared/validation";
import { writeAuditLog } from "./shared/audit";

const RANGE_MS = {
  today: 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "12m": 365 * 24 * 60 * 60 * 1000,
} as const;

type RangeKey = keyof typeof RANGE_MS;

function monthKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-GH", { month: "short", year: "numeric" });
}

/** Normalize a paid subscription into monthly recurring GH₵. Lifetime is excluded from MRR. */
function subscriptionMrr(sub: {
  status: string;
  isLifetime: boolean;
  billingCycle: string;
  amount: number;
  planKey: PlanKey;
}): number {
  if (sub.isLifetime) return 0;
  if (sub.status !== "active" && sub.status !== "trialing" && sub.status !== "past_due") {
    return 0;
  }
  if (sub.amount > 0) {
    if (sub.billingCycle === "yearly") return sub.amount / 12;
    if (sub.billingCycle === "monthly") return sub.amount;
  }
  const plan = PLAN_CATALOG[sub.planKey];
  if (sub.billingCycle === "yearly" && plan.yearlyPrice) return plan.yearlyPrice / 12;
  if (plan.monthlyPrice) return plan.monthlyPrice;
  return 0;
}

export const revenueAnalytics = query({
  args: {
    range: v.optional(
      v.union(v.literal("today"), v.literal("7d"), v.literal("30d"), v.literal("12m")),
    ),
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const range = (args.range ?? "30d") as RangeKey;
    const now = Date.now();
    const since = now - RANGE_MS[range];

    const [organizations, subscriptions, billing, costs] = await Promise.all([
      ctx.db.query("organizations").collect(),
      ctx.db.query("subscriptions").collect(),
      ctx.db.query("billingHistory").collect(),
      ctx.db.query("platformOperatingCosts").collect(),
    ]);

    const latestSubByOrg = new Map<string, (typeof subscriptions)[number]>();
    for (const sub of subscriptions) {
      const key = String(sub.organizationId);
      const existing = latestSubByOrg.get(key);
      if (!existing || sub.updatedAt > existing.updatedAt) {
        latestSubByOrg.set(key, sub);
      }
    }

    let mrr = 0;
    let lifetimeLicenses = 0;
    const planDistribution: Record<string, number> = {
      basic: 0,
      pro: 0,
      enterprise: 0,
      lifetime: 0,
    };

    for (const org of organizations) {
      const planKey = (org.planKey ?? "basic") as PlanKey;
      planDistribution[planKey] = (planDistribution[planKey] ?? 0) + 1;
      const sub = org.subscriptionId
        ? subscriptions.find((s) => s._id === org.subscriptionId)
        : latestSubByOrg.get(String(org._id));
      if (sub?.isLifetime || planKey === "lifetime") lifetimeLicenses += 1;
      if (sub) mrr += subscriptionMrr(sub);
    }

    const successfulPayments = billing.filter(
      (row) => row.status === "success" && (row.paidAt ?? row.createdAt) >= since,
    );
    const grossRevenue = successfulPayments.reduce((sum, row) => sum + row.amount, 0);

    const revenueByMonthMap = new Map<string, number>();
    for (const row of billing.filter((b) => b.status === "success")) {
      const ts = row.paidAt ?? row.createdAt;
      if (ts < since) continue;
      const key = monthKey(ts);
      revenueByMonthMap.set(key, (revenueByMonthMap.get(key) ?? 0) + row.amount);
    }

    const orgsByMonthMap = new Map<string, number>();
    for (const org of organizations) {
      if (org.createdAt < since) continue;
      const key = monthKey(org.createdAt);
      orgsByMonthMap.set(key, (orgsByMonthMap.get(key) ?? 0) + 1);
    }

    const periodCosts = costs.filter((c) => c.occurredAt >= since);
    const operatingCosts = periodCosts.reduce((sum, c) => sum + c.amount, 0);
    const costsByMonthMap = new Map<string, number>();
    for (const cost of periodCosts) {
      const key = monthKey(cost.occurredAt);
      costsByMonthMap.set(key, (costsByMonthMap.get(key) ?? 0) + cost.amount);
    }

    const monthKeys = [
      ...new Set([
        ...revenueByMonthMap.keys(),
        ...orgsByMonthMap.keys(),
        ...costsByMonthMap.keys(),
      ]),
    ].sort();

    const activeSubs = [...latestSubByOrg.values()].filter(
      (s) => s.status === "active" || s.status === "trialing",
    ).length;
    const expiredSubs = [...latestSubByOrg.values()].filter((s) => s.status === "expired").length;
    const cancelledSubs = [...latestSubByOrg.values()].filter(
      (s) => s.status === "cancelled",
    ).length;
    const denom = activeSubs + expiredSubs + cancelledSubs;
    const renewalRate = denom > 0 ? activeSubs / denom : 0;
    const churnRate = denom > 0 ? (expiredSubs + cancelledSubs) / denom : 0;

    return {
      range,
      currency: "GHS",
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      grossRevenue,
      operatingCosts,
      netProfit: grossRevenue - operatingCosts,
      lifetimeLicenses,
      activeOrganizations: organizations.filter((o) => o.status === "active").length,
      trialOrganizations: organizations.filter((o) => o.status === "trial").length,
      expiredOrganizations: organizations.filter((o) => o.status === "expired").length,
      renewalRate,
      churnRate,
      planDistribution: Object.entries(planDistribution).map(([key, count]) => ({
        key,
        name: resolvePlan(key as PlanKey).name,
        count,
      })),
      revenueByMonth: monthKeys.map((key) => ({
        month: key,
        label: monthLabel(key),
        revenue: revenueByMonthMap.get(key) ?? 0,
        costs: costsByMonthMap.get(key) ?? 0,
        profit: (revenueByMonthMap.get(key) ?? 0) - (costsByMonthMap.get(key) ?? 0),
        newOrganizations: orgsByMonthMap.get(key) ?? 0,
      })),
      recentPayments: successfulPayments
        .sort((a, b) => (b.paidAt ?? b.createdAt) - (a.paidAt ?? a.createdAt))
        .slice(0, 12)
        .map((row) => ({
          id: row._id,
          organizationId: row.organizationId,
          amount: row.amount,
          currency: row.currency,
          planKey: row.planKey ?? null,
          description: row.description,
          paidAt: row.paidAt ?? row.createdAt,
          gateway: row.gateway,
        })),
    };
  },
});

export const listSubscriptions = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);
    const [organizations, subscriptions, devices, backups, profiles] = await Promise.all([
      ctx.db.query("organizations").collect(),
      ctx.db.query("subscriptions").collect(),
      ctx.db.query("devices").collect(),
      ctx.db.query("cloudBackups").collect(),
      ctx.db.query("profiles").collect(),
    ]);

    const latestSubByOrg = new Map<string, (typeof subscriptions)[number]>();
    for (const sub of subscriptions) {
      const key = String(sub.organizationId);
      const existing = latestSubByOrg.get(key);
      if (!existing || sub.updatedAt > existing.updatedAt) {
        latestSubByOrg.set(key, sub);
      }
    }

    const deviceCountByOrg = new Map<string, number>();
    for (const device of devices) {
      if (!device.isActive) continue;
      const key = String(device.organizationId);
      deviceCountByOrg.set(key, (deviceCountByOrg.get(key) ?? 0) + 1);
    }

    const storageByOrg = new Map<string, number>();
    for (const backup of backups) {
      const key = String(backup.organizationId);
      storageByOrg.set(key, (storageByOrg.get(key) ?? 0) + backup.sizeBytes);
    }

    const usersByOrg = new Map<string, number>();
    for (const profile of profiles) {
      const key = String(profile.organizationId);
      usersByOrg.set(key, (usersByOrg.get(key) ?? 0) + 1);
    }

    return organizations
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((org) => {
        const sub = org.subscriptionId
          ? subscriptions.find((s) => s._id === org.subscriptionId)
          : latestSubByOrg.get(String(org._id));
        const planKey = (org.planKey ?? sub?.planKey ?? "basic") as PlanKey;
        return {
          id: org._id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          planKey,
          plan: resolvePlan(planKey).name,
          subscriptionStatus: sub?.status ?? null,
          billingCycle: sub?.billingCycle ?? null,
          isLifetime: Boolean(sub?.isLifetime || planKey === "lifetime"),
          amount: sub?.amount ?? 0,
          currency: sub?.currency ?? org.currency,
          renewalDate: sub?.nextBillingDate ?? sub?.expiresAt ?? org.trialEndsAt ?? null,
          users: usersByOrg.get(String(org._id)) ?? 0,
          devices: deviceCountByOrg.get(String(org._id)) ?? 0,
          storageBytes: storageByOrg.get(String(org._id)) ?? 0,
          lastPaymentAmount: sub?.amount ?? null,
          createdAt: org.createdAt,
        };
      });
  },
});

export const listOperatingCosts = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);
    const rows = await ctx.db.query("platformOperatingCosts").collect();
    return rows
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .map((row) => ({
        id: row._id,
        amount: row.amount,
        currency: row.currency,
        category: row.category,
        occurredAt: row.occurredAt,
        description: row.description ?? null,
        createdAt: row.createdAt,
      }));
  },
});

export const createOperatingCost = mutation({
  args: {
    amount: v.number(),
    category: platformCostCategoryValidator,
    occurredAt: v.number(),
    description: v.optional(v.string()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requirePlatformAdmin(ctx);
    if (!(args.amount > 0)) throw new Error("Amount must be greater than zero");
    const id = await ctx.db.insert("platformOperatingCosts", {
      amount: args.amount,
      currency: args.currency?.trim() || "GHS",
      category: args.category,
      occurredAt: args.occurredAt,
      description: args.description
        ? sanitizeText(args.description, "description", 500, { required: false, allowEmpty: true })
        : undefined,
      recordedBy: admin.userId,
      createdAt: Date.now(),
    });
    await writeAuditLog(ctx, {
      actorId: admin.userId,
      action: "platform_operating_cost_created",
      entityType: "platformOperatingCosts",
      entityId: id,
      metadata: { amount: args.amount, category: args.category },
    });
    return id;
  },
});

export const removeOperatingCost = mutation({
  args: { costId: v.id("platformOperatingCosts") },
  handler: async (ctx, args) => {
    const admin = await requirePlatformAdmin(ctx);
    const row = await ctx.db.get(args.costId);
    if (!row) throw new Error("Cost entry not found");
    await ctx.db.delete(args.costId);
    await writeAuditLog(ctx, {
      actorId: admin.userId,
      action: "platform_operating_cost_removed",
      entityType: "platformOperatingCosts",
      entityId: args.costId,
      metadata: { amount: row.amount, category: row.category },
    });
  },
});

export const systemHealth = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);
    const [
      organizations,
      subscriptions,
      devices,
      backups,
      profiles,
      desktopReleases,
      mobileReleases,
    ] = await Promise.all([
      ctx.db.query("organizations").collect(),
      ctx.db.query("subscriptions").collect(),
      ctx.db.query("devices").collect(),
      ctx.db.query("cloudBackups").collect(),
      ctx.db.query("profiles").collect(),
      ctx.db
        .query("desktopReleases")
        .withIndex("by_channel_releasedAt", (q) => q.eq("channel", "stable"))
        .order("desc")
        .take(1),
      ctx.db
        .query("mobileReleases")
        .withIndex("by_channel_releasedAt", (q) => q.eq("channel", "stable"))
        .order("desc")
        .take(1),
    ]);

    const activeDevices = devices.filter((d) => d.isActive);
    const storageBytes = backups.reduce((sum, b) => sum + b.sizeBytes, 0);
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    return {
      convexStatus: "ok" as const,
      organizationCount: organizations.length,
      profileCount: profiles.length,
      subscriptionCounts: {
        active: subscriptions.filter((s) => s.status === "active").length,
        trialing: subscriptions.filter((s) => s.status === "trialing").length,
        pastDue: subscriptions.filter((s) => s.status === "past_due").length,
        cancelled: subscriptions.filter((s) => s.status === "cancelled").length,
        expired: subscriptions.filter((s) => s.status === "expired").length,
      },
      devices: {
        total: devices.length,
        active: activeDevices.length,
        desktop: activeDevices.filter((d) => d.runtime === "desktop").length,
        web: activeDevices.filter((d) => d.runtime === "web").length,
        seenLast24h: activeDevices.filter((d) => d.lastSeenAt >= dayAgo).length,
      },
      storage: {
        backupCount: backups.length,
        totalBytes: storageBytes,
      },
      latestDesktopVersion: desktopReleases[0]?.version ?? null,
      latestDesktopTag: desktopReleases[0]?.tag ?? null,
      latestMobileVersion: mobileReleases[0]?.version ?? null,
      latestMobileTag: mobileReleases[0]?.tag ?? null,
      checkedAt: now,
    };
  },
});
