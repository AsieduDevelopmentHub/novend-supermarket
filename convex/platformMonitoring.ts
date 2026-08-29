import { v } from "convex/values";
import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { requirePlatformAdmin } from "./shared/permissions";
import { resolvePlan, type PlanKey } from "./shared/plans";
import { utcDay } from "./shared/platformTelemetry";

const rangeValidator = v.union(
  v.literal("7d"),
  v.literal("30d"),
  v.literal("90d"),
  v.literal("12m"),
  v.literal("all"),
);

type MonitoringRange = "7d" | "30d" | "90d" | "12m" | "all";

const RANGE_DAYS: Record<Exclude<MonitoringRange, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "12m": 365,
};

function sinceForRange(range: MonitoringRange, now: number) {
  return range === "all" ? 0 : now - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
}

function subscriptionMrr(subscription: {
  status: string;
  isLifetime: boolean;
  billingCycle: string;
  amount: number;
  planKey: PlanKey;
}) {
  if (
    subscription.isLifetime ||
    !["active", "trialing", "past_due"].includes(subscription.status)
  ) {
    return 0;
  }
  const amount =
    subscription.amount > 0
      ? subscription.amount
      : subscription.billingCycle === "yearly"
        ? (resolvePlan(subscription.planKey).yearlyPrice ?? 0)
        : (resolvePlan(subscription.planKey).monthlyPrice ?? 0);
  return subscription.billingCycle === "yearly" ? amount / 12 : amount;
}

function countUnique<T>(rows: T[], key: (row: T) => string) {
  return new Set(rows.map(key)).size;
}

function percentageChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

export const dashboard = query({
  args: { range: v.optional(rangeValidator) },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const range = (args.range ?? "30d") as MonitoringRange;
    const now = Date.now();
    const since = sinceForRange(range, now);
    const sinceDay = utcDay(since);
    const previousSince = range === "all" ? 0 : since - (now - since);
    const rollupSinceDay = utcDay(previousSince);
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const [
      organizations,
      profiles,
      devices,
      subscriptions,
      billing,
      costs,
      backups,
      imports,
      exports,
      activeUsers,
      rollups,
      baselines,
    ] = await Promise.all([
      ctx.db.query("organizations").collect(),
      ctx.db.query("profiles").collect(),
      ctx.db.query("devices").collect(),
      ctx.db.query("subscriptions").collect(),
      ctx.db.query("billingHistory").collect(),
      ctx.db.query("platformOperatingCosts").collect(),
      ctx.db.query("cloudBackups").collect(),
      ctx.db.query("importJobs").withIndex("by_createdAt", (q) => q.gte("createdAt", since)).collect(),
      ctx.db.query("exportEvents").withIndex("by_createdAt", (q) => q.gte("createdAt", since)).collect(),
      ctx.db
        .query("platformDailyActiveUsers")
        .withIndex("by_day", (q) => q.gte("day", sinceDay))
        .collect(),
      ctx.db
        .query("platformDailyRollups")
        .withIndex("by_day_metric_dimension", (q) => q.gte("day", rollupSinceDay))
        .collect(),
      ctx.db.query("releaseDownloadBaselines").collect(),
    ]);

    const successfulPayments = billing.filter(
      (row) => row.status === "success" && (row.paidAt ?? row.createdAt) >= since,
    );
    const periodCosts = costs.filter((row) => row.occurredAt >= since);
    const activeDevices = devices.filter((device) => device.isActive);
    const currentRollups = rollups.filter((row) => row.day >= sinceDay);
    const previousRollups =
      range === "all"
        ? []
        : rollups.filter((row) => row.day >= rollupSinceDay && row.day < sinceDay);
    const trackedDownloads = currentRollups
      .filter((row) => row.metric === "release_download" && row.dimension === "all")
      .reduce((sum, row) => sum + row.value, 0);
    const previousTrackedDownloads = previousRollups
      .filter((row) => row.metric === "release_download" && row.dimension === "all")
      .reduce((sum, row) => sum + row.value, 0);
    const baselineDownloads = baselines.reduce((sum, row) => sum + row.downloadCount, 0);
    const mrr = subscriptions.reduce((sum, subscription) => sum + subscriptionMrr(subscription), 0);

    const activeRowsSince = (timestamp: number) =>
      activeUsers.filter((row) => row.lastSeenAt >= timestamp);
    const dauRows = activeRowsSince(dayAgo);
    const wauRows = activeRowsSince(weekAgo);
    const mauRows = activeRowsSince(monthAgo);

    const runtimeCounts = {
      web: 0,
      pwa: 0,
      electron: 0,
      android: 0,
      ios: 0,
    };
    for (const device of activeDevices) {
      if (device.runtime === "desktop") runtimeCounts.electron += 1;
      else if (device.runtime === "android") runtimeCounts.android += 1;
      else if (device.runtime === "ios") runtimeCounts.ios += 1;
      else if (device.deliveryMode === "pwa") runtimeCounts.pwa += 1;
      else runtimeCounts.web += 1;
    }

    const featureMap = new Map<string, number>();
    const downloadAssetMap = new Map<string, number>();
    const downloadVersionMap = new Map<string, number>();
    const seriesMap = new Map<
      string,
      { day: string; activeUsers: number; downloads: number; errors: number; featureEvents: number }
    >();
    for (const row of currentRollups) {
      const point = seriesMap.get(row.day) ?? {
        day: row.day,
        activeUsers: 0,
        downloads: 0,
        errors: 0,
        featureEvents: 0,
      };
      if (row.dimension === "all") {
        if (row.metric === "active_users") point.activeUsers += row.value;
        if (row.metric === "release_download") point.downloads += row.value;
        if (row.metric === "client_error") point.errors += row.value;
        if (row.metric === "feature_used") point.featureEvents += row.value;
      }
      seriesMap.set(row.day, point);
      if (row.metric === "feature_used" && row.dimension.startsWith("feature:")) {
        const key = row.dimension.slice(8);
        featureMap.set(key, (featureMap.get(key) ?? 0) + row.value);
      }
      if (row.metric === "release_download" && row.dimension.startsWith("asset:")) {
        const key = row.dimension.slice(6);
        downloadAssetMap.set(key, (downloadAssetMap.get(key) ?? 0) + row.value);
      }
      if (row.metric === "release_download" && row.dimension.startsWith("version:")) {
        const key = row.dimension.slice(8);
        downloadVersionMap.set(key, (downloadVersionMap.get(key) ?? 0) + row.value);
      }
    }
    for (const baseline of baselines) {
      downloadAssetMap.set(
        baseline.assetGroup,
        (downloadAssetMap.get(baseline.assetGroup) ?? 0) + baseline.downloadCount,
      );
      downloadVersionMap.set(
        baseline.releaseVersion,
        (downloadVersionMap.get(baseline.releaseVersion) ?? 0) + baseline.downloadCount,
      );
    }

    const planDistribution = ["basic", "pro", "enterprise", "lifetime"].map((planKey) => ({
      planKey,
      name: resolvePlan(planKey as PlanKey).name,
      count: organizations.filter((organization) => (organization.planKey ?? "basic") === planKey)
        .length,
    }));
    const trackedSince =
      baselines.length > 0 ? Math.min(...baselines.map((row) => row.trackedAt)) : null;
    const pendingPayments = billing.filter((row) => row.status === "pending");
    const failedPayments = billing.filter((row) => row.status === "failed");
    const createdOrganizations = organizations.filter((row) => row.createdAt >= since);
    const activatedOrganizationIds = new Set(
      devices.filter((row) => row.registeredAt >= since).map((row) => String(row.organizationId)),
    );
    const engagedOrganizationIds = new Set(
      activeUsers
        .filter((row) => row.organizationId)
        .map((row) => String(row.organizationId)),
    );
    const payingOrganizationIds = new Set(
      subscriptions
        .filter(
          (row) =>
            row.startsAt >= since &&
            (row.isLifetime || ["active", "trialing", "past_due"].includes(row.status)),
        )
        .map((row) => String(row.organizationId)),
    );
    const churnedSubscriptions = subscriptions.filter(
      (row) => row.cancelledAt && row.cancelledAt >= since,
    ).length;
    const recurringSubscriptions = subscriptions.filter((row) => !row.isLifetime).length;

    return {
      range,
      generatedAt: now,
      trackingStartedAt: trackedSince,
      kpis: {
        organizations: organizations.length,
        activeOrganizations: organizations.filter((row) => row.status === "active").length,
        trialOrganizations: organizations.filter((row) => row.status === "trial").length,
        staffAccounts: profiles.length,
        dau: countUnique(dauRows, (row) => String(row.userId)),
        wau: countUnique(wauRows, (row) => String(row.userId)),
        mau: countUnique(mauRows, (row) => String(row.userId)),
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(mrr * 1200) / 100,
        grossRevenue: successfulPayments.reduce((sum, row) => sum + row.amount, 0),
        operatingCosts: periodCosts.reduce((sum, row) => sum + row.amount, 0),
        downloads: baselineDownloads + trackedDownloads,
        activeDevices: activeDevices.length,
        churnRate:
          recurringSubscriptions > 0 ? churnedSubscriptions / recurringSubscriptions : 0,
        activationRate:
          createdOrganizations.length > 0
            ? engagedOrganizationIds.size / createdOrganizations.length
            : 0,
      },
      activationFunnel: [
        { stage: "Organizations created", count: createdOrganizations.length },
        { stage: "Device activated", count: activatedOrganizationIds.size },
        { stage: "Active user", count: engagedOrganizationIds.size },
        { stage: "Paid plan", count: payingOrganizationIds.size },
      ],
      runtimeCounts,
      planDistribution,
      featureAdoption: [...featureMap.entries()]
        .map(([feature, count]) => ({ feature, count }))
        .sort((a, b) => b.count - a.count),
      downloadAssets: [...downloadAssetMap.entries()]
        .map(([assetGroup, count]) => ({ assetGroup, count }))
        .sort((a, b) => b.count - a.count),
      releaseAdoption: [...downloadVersionMap.entries()]
        .map(([version, downloads]) => ({
          version,
          downloads,
          activeDevices: activeDevices.filter((device) => device.appVersion === version).length,
        }))
        .sort((a, b) => b.downloads - a.downloads),
      series: [...seriesMap.values()].sort((a, b) => a.day.localeCompare(b.day)),
      operations: {
        storageBytes: backups.reduce((sum, row) => sum + row.sizeBytes, 0),
        backupCount: backups.length,
        staleDevices: activeDevices.filter((device) => device.lastSeenAt < dayAgo).length,
        devicesSeenLast24h: activeDevices.filter((device) => device.lastSeenAt >= dayAgo).length,
        pendingPayments: pendingPayments.length,
        stalePendingPayments: pendingPayments.filter(
          (row) => now - row.createdAt > 30 * 60 * 1000,
        ).length,
        failedPayments: failedPayments.length,
        clientErrors: currentRollups
          .filter((row) => row.metric === "client_error" && row.dimension === "all")
          .reduce((sum, row) => sum + row.value, 0),
        syncFailures: currentRollups
          .filter(
            (row) => row.metric === "sync_health" && row.dimension === "action:failed",
          )
          .reduce((sum, row) => sum + row.value, 0),
        imports: imports.length,
        failedImports: imports.filter((row) => row.status === "failed").length,
        exports: exports.length,
      },
      comparisons: {
        organizationGrowth:
          range === "all"
            ? null
            : percentageChange(
                organizations.filter((row) => row.createdAt >= since).length,
                organizations.filter(
                  (row) => row.createdAt >= previousSince && row.createdAt < since,
                ).length,
              ),
        revenue:
          range === "all"
            ? null
            : percentageChange(
                successfulPayments.reduce((sum, row) => sum + row.amount, 0),
                billing
                  .filter(
                    (row) =>
                      row.status === "success" &&
                      (row.paidAt ?? row.createdAt) >= previousSince &&
                      (row.paidAt ?? row.createdAt) < since,
                  )
                  .reduce((sum, row) => sum + row.amount, 0),
              ),
        downloads:
          range === "all"
            ? null
            : percentageChange(trackedDownloads, previousTrackedDownloads),
        clientErrors:
          range === "all"
            ? null
            : percentageChange(
                currentRollups
                  .filter((row) => row.metric === "client_error" && row.dimension === "all")
                  .reduce((sum, row) => sum + row.value, 0),
                previousRollups
                  .filter((row) => row.metric === "client_error" && row.dimension === "all")
                  .reduce((sum, row) => sum + row.value, 0),
              ),
      },
      recentOrganizations: organizations
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 8)
        .map((organization) => ({
          id: organization._id,
          name: organization.name,
          slug: organization.slug,
          status: organization.status,
          planKey: organization.planKey ?? "basic",
          createdAt: organization.createdAt,
        })),
    };
  },
});

const activitySourceValidator = v.union(v.literal("audit"), v.literal("telemetry"));

export const activity = query({
  args: {
    source: activitySourceValidator,
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    if (args.source === "audit") {
      const result = await ctx.db
        .query("auditLogs")
        .withIndex("by_createdAt")
        .order("desc")
        .paginate(args.paginationOpts);
      return {
        ...result,
        page: result.page.map((row) => ({
          id: row._id,
          source: "audit" as const,
          organizationId: row.organizationId ?? null,
          action: row.action,
          entityType: row.entityType,
          detail: row.entityId ?? null,
          occurredAt: row.createdAt,
        })),
      };
    }
    const result = await ctx.db
      .query("platformEvents")
      .withIndex("by_occurredAt")
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((row) => ({
        id: row._id,
        source: "telemetry" as const,
        organizationId: row.organizationId ?? null,
        action: row.kind,
        entityType: row.feature ?? row.releaseKind ?? "platform",
        detail: row.action ?? row.assetGroup ?? row.errorCode ?? null,
        occurredAt: row.occurredAt,
      })),
    };
  },
});
