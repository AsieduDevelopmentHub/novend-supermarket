import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlatformAdmin } from "./shared/permissions";
import { resolvePlan, type PlanKey } from "./shared/plans";
import { platformCostCategoryValidator } from "./schema";
import { sanitizeText } from "./shared/validation";
import { writeAuditLog } from "./shared/audit";
import { utcDay } from "./shared/platformTelemetry";
import { indexLiveOffersByOrganization, subscriptionMrr } from "./shared/platformRevenue";
import { readPlatformStats } from "./shared/platformStatsAggregate";

const RANGE_MS = {
  today: 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "12m": 365 * 24 * 60 * 60 * 1000,
} as const;

type RangeKey = keyof typeof RANGE_MS;
type RangeKeyOrAll = RangeKey | "all";

const rangeValidator = v.union(
  v.literal("today"),
  v.literal("7d"),
  v.literal("30d"),
  v.literal("12m"),
);
const rangeOrAllValidator = v.union(rangeValidator, v.literal("all"));

function rangeSince(range: RangeKeyOrAll, now: number): number {
  return range === "all" ? 0 : now - RANGE_MS[range];
}

function monthKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-GH", { month: "short", year: "numeric" });
}

export const revenueAnalytics = query({
  args: {
    range: v.optional(rangeOrAllValidator),
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx, "analytics.read");
    const range = (args.range ?? "30d") as RangeKeyOrAll;
    const now = Date.now();
    const since = rangeSince(range, now);

    const [organizations, subscriptions, billing, costs, backups, commercialOffers] =
      await Promise.all([
        ctx.db.query("organizations").collect(),
        ctx.db.query("subscriptions").collect(),
        ctx.db.query("billingHistory").collect(),
        ctx.db.query("platformOperatingCosts").collect(),
        ctx.db.query("cloudBackups").collect(),
        ctx.db.query("commercialOffers").collect(),
      ]);

    const liveOffersByOrg = indexLiveOffersByOrganization(commercialOffers, now);

    const commercialOrgIds = new Set(
      organizations
        .filter((org) => org.isTestOrganization !== true)
        .map((org) => String(org._id)),
    );

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
      if (org.isTestOrganization === true) continue;
      const planKey = (org.planKey ?? "basic") as PlanKey;
      planDistribution[planKey] = (planDistribution[planKey] ?? 0) + 1;
      const sub = org.subscriptionId
        ? subscriptions.find((s) => s._id === org.subscriptionId)
        : latestSubByOrg.get(String(org._id));
      if (sub?.isLifetime || planKey === "lifetime") lifetimeLicenses += 1;
      if (sub) {
        mrr += subscriptionMrr(sub, liveOffersByOrg.get(String(org._id)) ?? null, now);
      }
    }

    const successfulPayments = billing.filter(
      (row) =>
        row.status === "success" &&
        commercialOrgIds.has(String(row.organizationId)) &&
        (row.paidAt ?? row.createdAt) >= since,
    );
    const grossRevenue = successfulPayments.reduce((sum, row) => sum + row.amount, 0);

    const revenueByMonthMap = new Map<string, number>();
    for (const row of billing.filter(
      (b) => b.status === "success" && commercialOrgIds.has(String(b.organizationId)),
    )) {
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

    const storageByMonthMap = new Map<string, number>();
    for (const backup of backups) {
      if (backup.createdAt < since) continue;
      const key = monthKey(backup.createdAt);
      storageByMonthMap.set(key, (storageByMonthMap.get(key) ?? 0) + backup.sizeBytes);
    }

    const monthKeys = [
      ...new Set([
        ...revenueByMonthMap.keys(),
        ...orgsByMonthMap.keys(),
        ...costsByMonthMap.keys(),
        ...storageByMonthMap.keys(),
      ]),
    ].sort();

    let cumulativeStorage = backups
      .filter((b) => b.createdAt < since)
      .reduce((sum, b) => sum + b.sizeBytes, 0);

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
      revenueByMonth: monthKeys.map((key) => {
        cumulativeStorage += storageByMonthMap.get(key) ?? 0;
        return {
          month: key,
          label: monthLabel(key),
          revenue: revenueByMonthMap.get(key) ?? 0,
          costs: costsByMonthMap.get(key) ?? 0,
          profit: (revenueByMonthMap.get(key) ?? 0) - (costsByMonthMap.get(key) ?? 0),
          newOrganizations: orgsByMonthMap.get(key) ?? 0,
          storageBytes: cumulativeStorage,
        };
      }),
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
    await requirePlatformAdmin(ctx, "analytics.read");
    // Prefer organizationPlatformStats + active devices over full profiles/devices scans.
    const [organizations, subscriptions, activeDevices, backups, orgStats, billing] =
      await Promise.all([
        ctx.db.query("organizations").collect(),
        ctx.db.query("subscriptions").collect(),
        ctx.db
          .query("devices")
          .withIndex("by_isActive", (q) => q.eq("isActive", true))
          .collect(),
        ctx.db.query("cloudBackups").collect(),
        ctx.db.query("organizationPlatformStats").collect(),
        ctx.db.query("billingHistory").collect(),
      ]);

    const successfulByOrg = new Map<string, (typeof billing)[number][]>();
    for (const row of billing) {
      if (row.status !== "success") continue;
      const key = String(row.organizationId);
      const list = successfulByOrg.get(key) ?? [];
      list.push(row);
      successfulByOrg.set(key, list);
    }

    const latestSubByOrg = new Map<string, (typeof subscriptions)[number]>();
    for (const sub of subscriptions) {
      const key = String(sub.organizationId);
      const existing = latestSubByOrg.get(key);
      if (!existing || sub.updatedAt > existing.updatedAt) {
        latestSubByOrg.set(key, sub);
      }
    }

    const deviceCountByOrg = new Map<string, number>();
    for (const device of activeDevices) {
      const key = String(device.organizationId);
      deviceCountByOrg.set(key, (deviceCountByOrg.get(key) ?? 0) + 1);
    }

    const storageByOrg = new Map<string, number>();
    for (const backup of backups) {
      const key = String(backup.organizationId);
      storageByOrg.set(key, (storageByOrg.get(key) ?? 0) + backup.sizeBytes);
    }

    const statsByOrg = new Map(orgStats.map((row) => [String(row.organizationId), row]));

    return organizations
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((org) => {
        const sub = org.subscriptionId
          ? subscriptions.find((s) => s._id === org.subscriptionId)
          : latestSubByOrg.get(String(org._id));
        const planKey = (org.planKey ?? sub?.planKey ?? "basic") as PlanKey;
        const payments = successfulByOrg.get(String(org._id)) ?? [];
        const revenueAll = payments.reduce((sum, row) => sum + row.amount, 0);
        const lastPayment = payments.sort(
          (a, b) => (b.paidAt ?? b.createdAt) - (a.paidAt ?? a.createdAt),
        )[0];
        const stats = statsByOrg.get(String(org._id));
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
          users: stats?.userCount ?? 0,
          devices: deviceCountByOrg.get(String(org._id)) ?? 0,
          storageBytes: storageByOrg.get(String(org._id)) ?? 0,
          revenueAll,
          lastPaymentAmount: lastPayment?.amount ?? null,
          lastPaymentAt: lastPayment?.paidAt ?? lastPayment?.createdAt ?? null,
          createdAt: org.createdAt,
        };
      });
  },
});

export const listOperatingCosts = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx, "costs.read");
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
    const admin = await requirePlatformAdmin(ctx, "costs.write");
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
    const admin = await requirePlatformAdmin(ctx, "costs.write");
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
    await requirePlatformAdmin(ctx, "analytics.read");
    const [
      globalStats,
      orgStats,
      subscriptions,
      activeDevices,
      backups,
      desktopReleases,
      mobileReleases,
      pendingPayments,
      failedPayments,
    ] = await Promise.all([
      readPlatformStats(ctx),
      ctx.db.query("organizationPlatformStats").collect(),
      ctx.db.query("subscriptions").collect(),
      ctx.db
        .query("devices")
        .withIndex("by_isActive", (q) => q.eq("isActive", true))
        .collect(),
      ctx.db.query("cloudBackups").collect(),
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
      ctx.db
        .query("billingHistory")
        .withIndex("by_status_gateway_createdAt", (q) =>
          q.eq("status", "pending").eq("gateway", "paystack"),
        )
        .take(100),
      ctx.db
        .query("billingHistory")
        .withIndex("by_status_gateway_createdAt", (q) =>
          q.eq("status", "failed").eq("gateway", "paystack"),
        )
        .order("desc")
        .take(100),
    ]);

    const storageBytes = backups.reduce((sum, b) => sum + b.sizeBytes, 0);
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const profileCount = orgStats.reduce((sum, row) => sum + row.userCount, 0);

    return {
      convexStatus: "ok" as const,
      organizationCount: globalStats?.organizationCount ?? 0,
      profileCount: globalStats?.userCount ?? profileCount,
      subscriptionCounts: {
        active: subscriptions.filter((s) => s.status === "active").length,
        trialing: subscriptions.filter((s) => s.status === "trialing").length,
        pastDue: subscriptions.filter((s) => s.status === "past_due").length,
        cancelled: subscriptions.filter((s) => s.status === "cancelled").length,
        expired: subscriptions.filter((s) => s.status === "expired").length,
      },
      devices: {
        // Prefer platformStats for total (includes inactive). Active mix uses by_isActive.
        total: globalStats?.deviceCount ?? activeDevices.length,
        active: activeDevices.length,
        desktop: activeDevices.filter((d) => d.runtime === "desktop").length,
        web: activeDevices.filter((d) => d.runtime === "web").length,
        android: activeDevices.filter((d) => d.runtime === "android").length,
        ios: activeDevices.filter((d) => d.runtime === "ios").length,
        mobile: activeDevices.filter((d) => d.runtime === "android" || d.runtime === "ios").length,
        seenLast24h: activeDevices.filter((d) => d.lastSeenAt >= dayAgo).length,
      },
      storage: {
        backupCount: backups.length,
        totalBytes: storageBytes,
      },
      billingOperations: {
        pending: pendingPayments.length,
        stalePending: pendingPayments.filter((row) => now - row.createdAt > 30 * 60 * 1000).length,
        failed: failedPayments.length,
        lastFailureAt: failedPayments[0]?.updatedAt ?? null,
      },
      /**
       * Sync freshness proxy. Novend has no server-side sync-queue table (the
       * outbox lives in each device's Dexie replica), so this reports device
       * check-in recency instead of fabricating a queue depth.
       */
      sync: {
        backupsLast24h: backups.filter((b) => b.createdAt >= dayAgo).length,
        devicesSeenLast24h: activeDevices.filter((d) => d.lastSeenAt >= dayAgo).length,
        devicesStale: activeDevices.filter((d) => d.lastSeenAt < dayAgo).length,
      },
      latestDesktopVersion: desktopReleases[0]?.version ?? null,
      latestDesktopTag: desktopReleases[0]?.tag ?? null,
      latestMobileVersion: mobileReleases[0]?.version ?? null,
      latestMobileTag: mobileReleases[0]?.tag ?? null,
      checkedAt: now,
    };
  },
});

const insightMetricValidator = v.union(
  v.literal("mrr"),
  v.literal("arr"),
  v.literal("active-organizations"),
  v.literal("trial-organizations"),
  v.literal("expired-subscriptions"),
  v.literal("lifetime-licenses"),
  v.literal("active-devices"),
  v.literal("cloud-storage"),
  v.literal("mau"),
  v.literal("downloads"),
  v.literal("gross-revenue"),
  v.literal("staff-accounts"),
  v.literal("client-errors"),
);

export type PlatformInsightMetric =
  | "mrr"
  | "arr"
  | "active-organizations"
  | "trial-organizations"
  | "expired-subscriptions"
  | "lifetime-licenses"
  | "active-devices"
  | "cloud-storage"
  | "mau"
  | "downloads"
  | "gross-revenue"
  | "staff-accounts"
  | "client-errors";

const INSIGHT_COPY: Record<PlatformInsightMetric, { title: string; description: string }> = {
  mrr: {
    title: "Monthly Recurring Revenue",
    description:
      "Recognized recurring value from each paying subscription's stored amount (active and past-due), normalized to a month. Trials and unpaid offer list prices are excluded until the licence amount is set.",
  },
  arr: {
    title: "Annual Recurring Revenue",
    description:
      "MRR annualized (× 12) — the run-rate if today's paying subscriptions hold for a year.",
  },
  "active-organizations": {
    title: "Active Organizations",
    description: "Tenants with a paid, in-good-standing subscription.",
  },
  "trial-organizations": {
    title: "Trial Organizations",
    description: "Tenants currently inside their trial window.",
  },
  "expired-subscriptions": {
    title: "Expired Subscriptions",
    description: "Subscriptions past their expiry that have not renewed or been extended.",
  },
  "lifetime-licenses": {
    title: "Lifetime Licenses",
    description: "Organizations that purchased a permanent Lifetime licence.",
  },
  "active-devices": {
    title: "Active Devices",
    description: "Desktop and web/PWA installations currently authorized to sync.",
  },
  "cloud-storage": {
    title: "Cloud Storage Used",
    description: "Total backup storage consumed across every organization.",
  },
  mau: {
    title: "Monthly Active Users",
    description: "Distinct authenticated users seen in the last 30 days (pseudonymous daily rows).",
  },
  downloads: {
    title: "Installer Downloads",
    description: "GitHub baseline plus Novend-tracked installer and update-manifest downloads.",
  },
  "gross-revenue": {
    title: "Gross Revenue",
    description: "Successful billing payments in the selected range (not MRR run-rate).",
  },
  "staff-accounts": {
    title: "Staff Accounts",
    description: "Tenant profiles across every organization.",
  },
  "client-errors": {
    title: "Client Errors",
    description:
      "Sanitized client-error rollups (runtime, feature, and fingerprint). Open a row for recent events — codes are categories, not stack traces.",
  },
};

/** Drill-down data behind a dashboard/health KPI card. */
export const getInsightDetail = query({
  args: { metric: insightMetricValidator, range: v.optional(rangeOrAllValidator) },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx, "analytics.read");
    const range = (args.range ?? "12m") as RangeKeyOrAll;
    const now = Date.now();
    const since = rangeSince(range, now);
    const copy = INSIGHT_COPY[args.metric];

    const [organizations, subscriptions, devices, backups, billing, commercialOffers] =
      await Promise.all([
        ctx.db.query("organizations").collect(),
        ctx.db.query("subscriptions").collect(),
        ctx.db.query("devices").collect(),
        ctx.db.query("cloudBackups").collect(),
        ctx.db.query("billingHistory").collect(),
        ctx.db.query("commercialOffers").collect(),
      ]);

    const liveOffersByOrg = indexLiveOffersByOrganization(commercialOffers, now);

    const commercialOrganizations = organizations.filter(
      (org) => org.isTestOrganization !== true,
    );
    const commercialOrgIds = new Set(commercialOrganizations.map((org) => String(org._id)));

    const latestSubByOrg = new Map<string, (typeof subscriptions)[number]>();
    for (const sub of subscriptions) {
      const key = String(sub.organizationId);
      const existing = latestSubByOrg.get(key);
      if (!existing || sub.updatedAt > existing.updatedAt) latestSubByOrg.set(key, sub);
    }
    const orgLookup = new Map(organizations.map((o) => [String(o._id), o]));
    const subFor = (org: (typeof organizations)[number]) =>
      org.subscriptionId
        ? subscriptions.find((s) => s._id === org.subscriptionId)
        : latestSubByOrg.get(String(org._id));

    function orgRow(org: (typeof organizations)[number], extra?: Record<string, unknown>) {
      return {
        organizationId: org._id,
        name: org.name,
        slug: org.slug,
        plan: resolvePlan(org.planKey).name,
        status: org.status,
        createdAt: org.createdAt,
        ...extra,
      };
    }

    function monthlySeries(
      timestamps: number[],
      valueOf: (ts: number) => number = () => 1,
    ): Array<{ month: string; label: string; value: number }> {
      const buckets = new Map<string, number>();
      for (const ts of timestamps) {
        if (ts < since) continue;
        const key = monthKey(ts);
        buckets.set(key, (buckets.get(key) ?? 0) + valueOf(ts));
      }
      return [...buckets.keys()]
        .sort()
        .map((key) => ({ month: key, label: monthLabel(key), value: buckets.get(key) ?? 0 }));
    }

    let value = 0;
    let trend: Array<{ month: string; label: string; value: number }> = [];
    let rows: Array<Record<string, unknown>> = [];
    let rowsLabel = "Organizations";

    switch (args.metric) {
      case "mrr":
      case "arr": {
        let mrr = 0;
        const byPlan = new Map<string, number>();
        for (const org of commercialOrganizations) {
          const sub = subFor(org);
          if (!sub) continue;
          const contribution = subscriptionMrr(
            sub,
            liveOffersByOrg.get(String(org._id)) ?? null,
            now,
          );
          mrr += contribution;
          const planName = resolvePlan(org.planKey).name;
          byPlan.set(planName, (byPlan.get(planName) ?? 0) + contribution);
        }
        value = args.metric === "arr" ? mrr * 12 : mrr;
        const successfulPayments = billing.filter(
          (row) =>
            row.status === "success" &&
            commercialOrgIds.has(String(row.organizationId)) &&
            (row.paidAt ?? row.createdAt) >= since,
        );
        trend = monthlySeries(
          successfulPayments.map((row) => row.paidAt ?? row.createdAt),
          () => 0,
        ).map((point) => ({
          ...point,
          value: successfulPayments
            .filter((row) => monthKey(row.paidAt ?? row.createdAt) === point.month)
            .reduce((sum, row) => sum + row.amount, 0),
        }));
        rowsLabel = "Contribution by plan";
        rows = [...byPlan.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }));
        break;
      }
      case "active-organizations": {
        const matches = organizations.filter((o) => o.status === "active");
        value = matches.length;
        trend = monthlySeries(matches.map((o) => o.createdAt));
        rows = matches
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 50)
          .map((o) => orgRow(o));
        break;
      }
      case "trial-organizations": {
        const matches = organizations.filter((o) => o.status === "trial");
        value = matches.length;
        trend = monthlySeries(matches.map((o) => o.createdAt));
        rows = matches
          .sort((a, b) => (a.trialEndsAt ?? 0) - (b.trialEndsAt ?? 0))
          .slice(0, 50)
          .map((o) => orgRow(o, { trialEndsAt: o.trialEndsAt ?? null }));
        break;
      }
      case "expired-subscriptions": {
        const expired = [...latestSubByOrg.values()].filter((s) => s.status === "expired");
        value = expired.length;
        trend = monthlySeries(expired.map((s) => s.expiresAt ?? s.updatedAt));
        rows = expired
          .sort((a, b) => (b.expiresAt ?? 0) - (a.expiresAt ?? 0))
          .slice(0, 50)
          .map((s) => {
            const org = orgLookup.get(String(s.organizationId));
            return org ? orgRow(org, { expiredAt: s.expiresAt ?? null }) : null;
          })
          .filter((row): row is NonNullable<typeof row> => row !== null);
        break;
      }
      case "lifetime-licenses": {
        const matches = organizations.filter((o) => {
          const sub = subFor(o);
          return Boolean(sub?.isLifetime) || o.planKey === "lifetime";
        });
        value = matches.length;
        trend = monthlySeries(matches.map((o) => o.createdAt));
        rows = matches
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 50)
          .map((o) => orgRow(o));
        break;
      }
      case "active-devices": {
        const active = devices.filter((d) => d.isActive);
        value = active.length;
        trend = monthlySeries(active.map((d) => d.registeredAt));
        rowsLabel = "Devices";
        rows = active
          .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
          .slice(0, 50)
          .map((d) => {
            const org = orgLookup.get(String(d.organizationId));
            return {
              organizationId: d.organizationId,
              organizationName: org?.name ?? "Unknown",
              name: d.name,
              platform: d.platform,
              runtime: d.runtime,
              lastSeenAt: d.lastSeenAt,
            };
          });
        break;
      }
      case "cloud-storage": {
        value = backups.reduce((sum, b) => sum + b.sizeBytes, 0);
        trend = monthlySeries(
          backups.map((b) => b.createdAt),
          () => 0,
        ).map((point) => ({
          ...point,
          value: backups
            .filter((b) => monthKey(b.createdAt) === point.month)
            .reduce((sum, b) => sum + b.sizeBytes, 0),
        }));
        rowsLabel = "Storage by organization";
        const byOrg = new Map<string, number>();
        for (const b of backups) {
          const key = String(b.organizationId);
          byOrg.set(key, (byOrg.get(key) ?? 0) + b.sizeBytes);
        }
        rows = [...byOrg.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50)
          .map(([orgId, bytes]) => {
            const org = orgLookup.get(orgId);
            return { organizationId: orgId, name: org?.name ?? "Unknown", bytes };
          });
        break;
      }
      case "mau": {
        const sinceDay = utcDay(since);
        const activeUsers = await ctx.db
          .query("platformDailyActiveUsers")
          .withIndex("by_day", (q) => q.gte("day", sinceDay))
          .collect();
        value = new Set(activeUsers.map((row) => String(row.userId))).size;
        const byDay = new Map<string, Set<string>>();
        const byOrg = new Map<string, Set<string>>();
        for (const row of activeUsers) {
          const dayUsers = byDay.get(row.day) ?? new Set<string>();
          dayUsers.add(String(row.userId));
          byDay.set(row.day, dayUsers);
          if (row.organizationId) {
            const orgUsers = byOrg.get(String(row.organizationId)) ?? new Set<string>();
            orgUsers.add(String(row.userId));
            byOrg.set(String(row.organizationId), orgUsers);
          }
        }
        trend = [...byDay.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, users]) => ({
            month: day,
            label: day,
            value: users.size,
          }));
        rowsLabel = "Active users by organization";
        rows = [...byOrg.entries()]
          .sort((a, b) => b[1].size - a[1].size)
          .slice(0, 50)
          .map(([orgId, users]) => {
            const org = orgLookup.get(orgId);
            return {
              organizationId: orgId,
              name: org?.name ?? "Unknown",
              slug: org?.slug ?? "",
              plan: org ? resolvePlan(org.planKey).name : "—",
              createdAt: org?.createdAt ?? 0,
              count: users.size,
            };
          });
        break;
      }
      case "downloads": {
        const sinceDay = utcDay(since);
        const [rollups, baselines] = await Promise.all([
          ctx.db
            .query("platformDailyRollups")
            .withIndex("by_metric_day", (q) =>
              q.eq("metric", "release_download").gte("day", sinceDay),
            )
            .collect(),
          ctx.db.query("releaseDownloadBaselines").collect(),
        ]);
        const tracked = rollups
          .filter((row) => row.dimension === "all")
          .reduce((sum, row) => sum + row.value, 0);
        const baseline = baselines.reduce((sum, row) => sum + row.downloadCount, 0);
        value = baseline + tracked;
        const byDay = new Map<string, number>();
        const byDimension = new Map<string, number>();
        for (const row of rollups) {
          if (row.dimension === "all") {
            byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.value);
          } else {
            byDimension.set(row.dimension, (byDimension.get(row.dimension) ?? 0) + row.value);
          }
        }
        trend = [...byDay.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, amount]) => ({ month: day, label: day, value: amount }));
        rowsLabel = "Downloads by asset";
        rows = [
          ...[...byDimension.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 40)
            .map(([name, count]) => ({ name, count })),
          ...(baseline > 0 ? [{ name: "Historical GitHub baseline", count: baseline }] : []),
        ];
        break;
      }
      case "gross-revenue": {
        const successfulPayments = billing.filter(
          (row) =>
            row.status === "success" &&
            commercialOrgIds.has(String(row.organizationId)) &&
            (row.paidAt ?? row.createdAt) >= since,
        );
        value = successfulPayments.reduce((sum, row) => sum + row.amount, 0);
        trend = monthlySeries(
          successfulPayments.map((row) => row.paidAt ?? row.createdAt),
          () => 0,
        ).map((point) => ({
          ...point,
          value: successfulPayments
            .filter((row) => monthKey(row.paidAt ?? row.createdAt) === point.month)
            .reduce((sum, row) => sum + row.amount, 0),
        }));
        rowsLabel = "Successful payments";
        rows = successfulPayments
          .sort((a, b) => (b.paidAt ?? b.createdAt) - (a.paidAt ?? a.createdAt))
          .slice(0, 50)
          .map((row) => {
            const org = orgLookup.get(String(row.organizationId));
            return {
              organizationId: row.organizationId,
              name: org?.name ?? "Unknown",
              slug: org?.slug ?? "",
              plan: row.planKey
                ? resolvePlan(row.planKey).name
                : org
                  ? resolvePlan(org.planKey).name
                  : "—",
              amount: row.amount,
              createdAt: row.paidAt ?? row.createdAt,
            };
          });
        break;
      }
      case "staff-accounts": {
        const profiles = await ctx.db.query("profiles").collect();
        value = profiles.length;
        const byOrg = new Map<string, number>();
        for (const profile of profiles) {
          const key = String(profile.organizationId);
          byOrg.set(key, (byOrg.get(key) ?? 0) + 1);
        }
        trend = monthlySeries(
          profiles.map((profile) => profile.lastSeenAt ?? 0).filter((ts) => ts > 0),
        );
        rowsLabel = "Staff by organization";
        rows = [...byOrg.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50)
          .map(([orgId, count]) => {
            const org = orgLookup.get(orgId);
            return {
              organizationId: orgId,
              name: org?.name ?? "Unknown",
              slug: org?.slug ?? "",
              plan: org ? resolvePlan(org.planKey).name : "—",
              createdAt: org?.createdAt ?? 0,
              count,
            };
          });
        break;
      }
      case "client-errors": {
        const sinceDay = utcDay(since);
        const rollups = await ctx.db
          .query("platformDailyRollups")
          .withIndex("by_metric_day", (q) => q.eq("metric", "client_error").gte("day", sinceDay))
          .collect();
        const totals = rollups.filter((row) => row.dimension === "all");
        value = totals.reduce((sum, row) => sum + row.value, 0);
        const byDay = new Map<string, number>();
        const byCode = new Map<string, number>();
        for (const row of rollups) {
          if (row.dimension === "all") {
            byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.value);
          } else {
            byCode.set(row.dimension, (byCode.get(row.dimension) ?? 0) + row.value);
          }
        }
        trend = [...byDay.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, amount]) => ({ month: day, label: day, value: amount }));
        rowsLabel = "Errors by code";
        rows = [...byCode.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50)
          .map(([name, count]) => ({ name, count }));
        break;
      }
    }

    return {
      metric: args.metric,
      title: copy.title,
      description: copy.description,
      range,
      value,
      trend,
      rowsLabel,
      rows,
    };
  },
});

/** Parses rollup dimension keys like `runtime:android` or `feature:settings`. */
function parseClientErrorDimension(raw: string): {
  kind: "runtime" | "feature" | "action" | "code";
  value: string;
} | null {
  const trimmed = raw.trim().slice(0, 96);
  const match = /^(runtime|feature|action|code):([a-zA-Z0-9_.-]+)$/.exec(trimmed);
  if (!match) return null;
  return {
    kind: match[1] as "runtime" | "feature" | "action" | "code",
    value: match[2],
  };
}

/**
 * Recent client_error events for one rollup dimension (e.g. `runtime:android`).
 * Privacy-limited: no stacks or messages — only allowlisted fields already on platformEvents.
 */
export const getClientErrorCodeDetail = query({
  args: {
    code: v.string(),
    range: v.optional(rangeOrAllValidator),
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx, "analytics.read");
    const parsed = parseClientErrorDimension(args.code);
    if (!parsed) return null;

    const range = (args.range ?? "30d") as RangeKeyOrAll;
    const now = Date.now();
    const since = rangeSince(range, now);

    const recent = await ctx.db
      .query("platformEvents")
      .withIndex("by_kind_occurredAt", (q) => q.eq("kind", "client_error").gte("occurredAt", since))
      .order("desc")
      .take(400);

    const matched = recent.filter((row) => {
      if (parsed.kind === "runtime") return row.runtime === parsed.value;
      if (parsed.kind === "feature") return row.feature === parsed.value;
      if (parsed.kind === "action") return row.action === parsed.value;
      return row.errorCode === parsed.value;
    });

    const orgIds = [
      ...new Set(
        matched
          .map((row) => row.organizationId)
          .filter((id): id is NonNullable<typeof id> => id != null),
      ),
    ];
    const orgNames = new Map<string, string>();
    await Promise.all(
      orgIds.map(async (id) => {
        const org = await ctx.db.get(id);
        if (org?.name) orgNames.set(String(id), org.name);
      }),
    );

    const byErrorCode = new Map<string, number>();
    const byRuntime = new Map<string, number>();
    const byFeature = new Map<string, number>();
    const byAppVersion = new Map<string, number>();
    let total = 0;
    for (const row of matched) {
      total += row.count;
      if (row.errorCode) {
        byErrorCode.set(row.errorCode, (byErrorCode.get(row.errorCode) ?? 0) + row.count);
      }
      if (row.runtime) {
        byRuntime.set(row.runtime, (byRuntime.get(row.runtime) ?? 0) + row.count);
      }
      if (row.feature) {
        byFeature.set(row.feature, (byFeature.get(row.feature) ?? 0) + row.count);
      }
      if (row.appVersion) {
        byAppVersion.set(row.appVersion, (byAppVersion.get(row.appVersion) ?? 0) + row.count);
      }
    }

    const top = (map: Map<string, number>, limit = 12) =>
      [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, count]) => ({ name, count }));

    return {
      code: `${parsed.kind}:${parsed.value}`,
      kind: parsed.kind,
      value: parsed.value,
      range,
      total,
      eventCount: matched.length,
      byErrorCode: top(byErrorCode),
      byRuntime: top(byRuntime),
      byFeature: top(byFeature),
      byAppVersion: top(byAppVersion),
      events: matched.slice(0, 100).map((row) => ({
        id: row._id,
        organizationId: row.organizationId ? String(row.organizationId) : null,
        organizationName: row.organizationId
          ? (orgNames.get(String(row.organizationId)) ?? "Unknown")
          : null,
        feature: row.feature ?? null,
        runtime: row.runtime ?? null,
        appVersion: row.appVersion ?? null,
        errorCode: row.errorCode ?? null,
        count: row.count,
        occurredAt: row.occurredAt,
      })),
    };
  },
});

export const getPayment = query({
  args: { paymentId: v.id("billingHistory") },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx, "analytics.read");
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) return null;
    const org = await ctx.db.get(payment.organizationId);
    return {
      id: payment._id,
      organizationId: payment.organizationId,
      organizationName: org?.name ?? "Unknown organization",
      organizationSlug: org?.slug ?? null,
      subscriptionId: payment.subscriptionId ?? null,
      planKey: payment.planKey ?? null,
      plan: payment.planKey ? resolvePlan(payment.planKey).name : null,
      billingCycle: payment.billingCycle ?? null,
      amount: payment.amount,
      currency: payment.currency,
      gateway: payment.gateway,
      reference: payment.reference,
      status: payment.status,
      description: payment.description,
      paidAt: payment.paidAt ?? null,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      metadata: payment.metadata ?? null,
    };
  },
});

type DesktopReleaseRow = {
  _id: unknown;
  version: string;
  tag: string;
  channel: "stable" | "beta";
  notes: string;
  releasedAt: number;
  mandatory: boolean;
  githubReleaseUrl?: string;
  assets: Array<{
    githubAssetId: number;
    fileName: string;
    platform: string;
    arch: string;
    size?: number;
  }>;
};

type MobileReleaseRow = {
  _id: unknown;
  version: string;
  tag: string;
  channel: "stable" | "beta";
  notes: string;
  releasedAt: number;
  mandatory: boolean;
  githubReleaseUrl?: string;
  storeUrls?: { android?: string; ios?: string };
  assets: Array<{
    githubAssetId: number;
    fileName: string;
    platform: string;
    kind: string;
    size?: number;
  }>;
};

/** Merges a desktop + mobile release row pair into the platform-facing bundle shape. */
function buildReleaseBundle(
  fallbackVersion: string,
  desktop: DesktopReleaseRow | null,
  mobile: MobileReleaseRow | null,
) {
  const site = (process.env.CONVEX_SITE_URL || "").replace(/\/$/, "");
  const desktopAssets =
    desktop?.assets.map((asset) => ({
      source: "desktop" as const,
      githubAssetId: asset.githubAssetId,
      fileName: asset.fileName,
      kind: "installer",
      platform: asset.platform,
      arch: asset.arch,
      size: asset.size,
      downloadUrl: site
        ? `${site}/desktop-updates/assets/${desktop.version}/${encodeURIComponent(asset.fileName)}`
        : null,
    })) ?? [];
  const mobileAssets =
    mobile?.assets.map((asset) => ({
      source: "mobile" as const,
      githubAssetId: asset.githubAssetId,
      fileName: asset.fileName,
      kind: asset.kind,
      platform: asset.platform,
      arch: undefined as string | undefined,
      size: asset.size,
      downloadUrl: site
        ? `${site}/mobile-updates/assets/${mobile.version}/${encodeURIComponent(asset.fileName)}`
        : null,
    })) ?? [];

  return {
    version: desktop?.version ?? mobile?.version ?? fallbackVersion,
    tag: desktop?.tag ?? mobile?.tag ?? `v${fallbackVersion}`,
    channel: desktop?.channel ?? mobile?.channel ?? ("stable" as const),
    notes: desktop?.notes || mobile?.notes || "",
    releasedAt: Math.max(desktop?.releasedAt ?? 0, mobile?.releasedAt ?? 0),
    mandatory: Boolean(desktop?.mandatory || mobile?.mandatory),
    githubReleaseUrl: desktop?.githubReleaseUrl ?? mobile?.githubReleaseUrl ?? null,
    storeUrls: mobile?.storeUrls ?? {},
    desktop: desktop
      ? {
          id: desktop._id,
          version: desktop.version,
          tag: desktop.tag,
          channel: desktop.channel,
          notes: desktop.notes,
          releasedAt: desktop.releasedAt,
          mandatory: desktop.mandatory,
          assets: desktopAssets,
        }
      : null,
    mobile: mobile
      ? {
          id: mobile._id,
          version: mobile.version,
          tag: mobile.tag,
          channel: mobile.channel,
          notes: mobile.notes,
          releasedAt: mobile.releasedAt,
          mandatory: mobile.mandatory,
          storeUrls: mobile.storeUrls ?? {},
          assets: mobileAssets,
        }
      : null,
    assets: [...desktopAssets, ...mobileAssets],
  };
}

/** Combined desktop + mobile release bundle for a version string. */
export const getReleaseBundle = query({
  args: { version: v.string() },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx, "releases.read");
    const raw = args.version.trim();
    const bare = raw.replace(/^v/, "");
    const candidates = Array.from(new Set([raw, bare, `v${bare}`]));

    let desktop = null;
    for (const version of candidates) {
      desktop = await ctx.db
        .query("desktopReleases")
        .withIndex("by_version", (q) => q.eq("version", version))
        .unique();
      if (desktop) break;
    }

    let mobile = null;
    for (const version of candidates) {
      mobile = await ctx.db
        .query("mobileReleases")
        .withIndex("by_version", (q) => q.eq("version", version))
        .unique();
      if (mobile) break;
    }

    if (!desktop && !mobile) return null;
    return buildReleaseBundle(bare, desktop, mobile);
  },
});

/** Downloads screen — merged desktop + mobile release bundles, newest first. */
export const listReleaseBundles = query({
  args: {
    channel: v.optional(v.union(v.literal("stable"), v.literal("beta"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx, "releases.read");
    const channel = args.channel ?? "stable";
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);

    const [desktopRows, mobileRows] = await Promise.all([
      ctx.db
        .query("desktopReleases")
        .withIndex("by_channel_releasedAt", (q) => q.eq("channel", channel))
        .order("desc")
        .take(limit),
      ctx.db
        .query("mobileReleases")
        .withIndex("by_channel_releasedAt", (q) => q.eq("channel", channel))
        .order("desc")
        .take(limit),
    ]);

    const desktopByVersion = new Map(desktopRows.map((row) => [row.version, row]));
    const mobileByVersion = new Map(mobileRows.map((row) => [row.version, row]));
    const versions = [...new Set([...desktopByVersion.keys(), ...mobileByVersion.keys()])];

    return versions
      .map((version) =>
        buildReleaseBundle(
          version,
          desktopByVersion.get(version) ?? null,
          mobileByVersion.get(version) ?? null,
        ),
      )
      .sort((a, b) => b.releasedAt - a.releasedAt)
      .slice(0, limit);
  },
});
