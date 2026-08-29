import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requirePlatformAdmin } from "./shared/permissions";
import {
  classifyReleaseAsset,
  clampTelemetryTimestamp,
  isTelemetryAction,
  isTelemetryFeature,
  recordDailyActiveUser,
  recordTelemetryRollups,
  TELEMETRY_RETENTION_MS,
  utcDay,
} from "./shared/platformTelemetry";
import { telemetryEventKindValidator, telemetryRuntimeValidator } from "./schema";
import { writeAuditLog } from "./shared/audit";

type BaselineRelease = {
  releaseKind: "desktop" | "mobile";
  version: string;
  githubOwner: string;
  githubRepo: string;
  githubReleaseId?: number;
  assets: Array<{ githubAssetId: number; fileName: string }>;
};

const clientEventValidator = v.object({
  kind: v.union(
    v.literal("feature_used"),
    v.literal("workflow_completed"),
    v.literal("client_error"),
    v.literal("sync_health"),
  ),
  feature: v.optional(v.string()),
  action: v.optional(v.string()),
  runtime: telemetryRuntimeValidator,
  appVersion: v.optional(v.string()),
  errorCode: v.optional(v.string()),
  count: v.optional(v.number()),
  occurredAt: v.optional(v.number()),
});

/**
 * Records a small, allowlisted telemetry batch. Identity and organization come
 * from the authenticated session; callers cannot submit arbitrary tenant IDs.
 */
export const recordBatch = mutation({
  args: { events: v.array(clientEventValidator) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    if (args.events.length > 40) throw new Error("Telemetry batch is too large");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    const platformAdmin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if ((!profile || profile.status !== "active") && !platformAdmin) {
      throw new Error("Forbidden");
    }

    for (const event of args.events) {
      const feature = event.feature?.trim().toLowerCase();
      const action = event.action?.trim().toLowerCase();
      if (feature && !isTelemetryFeature(feature)) throw new Error("Unsupported telemetry feature");
      if (action && !isTelemetryAction(action)) throw new Error("Unsupported telemetry action");
      if (
        (event.kind === "feature_used" || event.kind === "workflow_completed") &&
        (!feature || !action)
      ) {
        throw new Error("Feature telemetry requires a feature and action");
      }

      const count = Math.min(Math.max(Math.trunc(event.count ?? 1), 1), 1000);
      const occurredAt = clampTelemetryTimestamp(event.occurredAt);
      const errorCode =
        event.kind === "client_error" && event.errorCode
          ? event.errorCode.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64)
          : undefined;
      await ctx.db.insert("platformEvents", {
        organizationId: profile?.organizationId,
        actorId: userId,
        kind: event.kind,
        feature,
        action,
        runtime: event.runtime,
        appVersion: event.appVersion?.slice(0, 32),
        errorCode,
        count,
        occurredAt,
      });
      await recordTelemetryRollups(ctx, {
        occurredAt,
        metric: event.kind,
        count,
        runtime: event.runtime,
        feature,
        action,
      });
      await recordDailyActiveUser(ctx, {
        userId,
        organizationId: profile?.organizationId,
        runtime: event.runtime,
        appVersion: event.appVersion,
        occurredAt,
      });
    }
    return { recorded: args.events.length };
  },
});

/** Internal path used by release redirect handlers. */
export const recordReleaseEvent = internalMutation({
  args: {
    kind: v.union(v.literal("release_download"), v.literal("release_update_check")),
    releaseKind: v.union(v.literal("desktop"), v.literal("mobile")),
    releaseVersion: v.string(),
    assetGroup: v.string(),
    source: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const occurredAt = clampTelemetryTimestamp(args.occurredAt);
    const releaseVersion = args.releaseVersion.trim().slice(0, 40);
    const assetGroup = args.assetGroup.trim().slice(0, 48);
    const source = args.source?.trim().slice(0, 32);
    await ctx.db.insert("platformEvents", {
      kind: args.kind,
      releaseKind: args.releaseKind,
      releaseVersion,
      assetGroup,
      source,
      count: 1,
      occurredAt,
    });
    await recordTelemetryRollups(ctx, {
      occurredAt,
      metric: args.kind,
      assetGroup,
      releaseVersion,
      source,
    });
  },
});

export const recordDailyPresence = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
    runtime: telemetryRuntimeValidator,
    appVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await recordDailyActiveUser(ctx, args);
  },
});

export const upsertDownloadBaseline = internalMutation({
  args: {
    releaseKind: v.union(v.literal("desktop"), v.literal("mobile")),
    releaseVersion: v.string(),
    githubAssetId: v.number(),
    fileName: v.string(),
    assetGroup: v.string(),
    downloadCount: v.number(),
    trackedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("releaseDownloadBaselines")
      .withIndex("by_asset", (q) =>
        q.eq("releaseKind", args.releaseKind).eq("githubAssetId", args.githubAssetId),
      )
      .unique();
    const values = {
      releaseVersion: args.releaseVersion.slice(0, 40),
      fileName: args.fileName.slice(0, 180),
      assetGroup: args.assetGroup.slice(0, 48),
      downloadCount: Math.max(0, Math.trunc(args.downloadCount)),
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, {
        releaseVersion: values.releaseVersion,
        fileName: values.fileName,
        assetGroup: values.assetGroup,
        updatedAt: values.updatedAt,
      });
      return existing._id;
    }
    return await ctx.db.insert("releaseDownloadBaselines", {
      releaseKind: args.releaseKind,
      githubAssetId: args.githubAssetId,
      trackedAt: args.trackedAt,
      ...values,
    });
  },
});

export const releaseCatalogForBaselines = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [desktop, mobile] = await Promise.all([
      ctx.db.query("desktopReleases").collect(),
      ctx.db.query("mobileReleases").collect(),
    ]);
    return [
      ...desktop.map((release) => ({
        releaseKind: "desktop" as const,
        version: release.version,
        githubOwner: release.githubOwner,
        githubRepo: release.githubRepo,
        githubReleaseId: release.githubReleaseId,
        assets: release.assets.map((asset) => ({
          githubAssetId: asset.githubAssetId,
          fileName: asset.fileName,
        })),
      })),
      ...mobile.map((release) => ({
        releaseKind: "mobile" as const,
        version: release.version,
        githubOwner: release.githubOwner,
        githubRepo: release.githubRepo,
        githubReleaseId: release.githubReleaseId,
        assets: release.assets.map((asset) => ({
          githubAssetId: asset.githubAssetId,
          fileName: asset.fileName,
        })),
      })),
    ];
  },
});

/**
 * Imports the pre-telemetry GitHub asset totals once. Subsequent download
 * trends come from Novend's redirect layer, so the historical baseline remains
 * immutable and cannot double-count later refreshes.
 */
export const seedDownloadBaselines = action({
  args: {},
  handler: async (ctx): Promise<{ seeded: number; examined: number }> => {
    await ctx.runQuery(internal.telemetry.requirePlatformAdminForAction, {});
    const token =
      process.env.DESKTOP_RELEASE_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
    if (!token) throw new Error("Release GitHub token is not configured");
    const releases = (await ctx.runQuery(
      internal.telemetry.releaseCatalogForBaselines,
      {},
    )) as BaselineRelease[];
    const trackedAt = Date.now();
    let seeded = 0;
    let examined = 0;

    for (const release of releases) {
      if (!release.githubReleaseId) continue;
      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(release.githubOwner)}/${encodeURIComponent(release.githubRepo)}/releases/${release.githubReleaseId}/assets?per_page=100`,
        {
          headers: {
            accept: "application/vnd.github+json",
            authorization: `Bearer ${token}`,
            "x-github-api-version": "2022-11-28",
          },
        },
      );
      if (!response.ok) throw new Error(`GitHub release lookup failed (${response.status})`);
      const githubAssets = (await response.json()) as Array<{
        id: number;
        name: string;
        download_count: number;
      }>;
      const knownAssetIds = new Set(release.assets.map((asset) => asset.githubAssetId));
      for (const asset of githubAssets) {
        if (!knownAssetIds.has(asset.id)) continue;
        examined += 1;
        await ctx.runMutation(internal.telemetry.upsertDownloadBaseline, {
          releaseKind: release.releaseKind,
          releaseVersion: release.version,
          githubAssetId: asset.id,
          fileName: asset.name,
          assetGroup: classifyReleaseAsset(asset.name),
          downloadCount: asset.download_count,
          trackedAt,
        });
        seeded += 1;
      }
    }
    return { seeded, examined };
  },
});

export const requirePlatformAdminForAction = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);
    return true;
  },
});

export const maintenance = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - TELEMETRY_RETENTION_MS;
    const events = await ctx.db
      .query("platformEvents")
      .withIndex("by_occurredAt", (q) => q.lt("occurredAt", cutoff))
      .take(500);
    for (const event of events) await ctx.db.delete(event._id);

    const activeRows = await ctx.db
      .query("platformDailyActiveUsers")
      .withIndex("by_day", (q) => q.lt("day", utcDay(cutoff)))
      .take(500);
    for (const row of activeRows) await ctx.db.delete(row._id);
    return { deletedEvents: events.length, deletedActiveRows: activeRows.length };
  },
});

export const activity = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    kind: v.optional(telemetryEventKindValidator),
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 50), 1), 100);
    const page = args.kind
      ? await ctx.db
          .query("platformEvents")
          .withIndex("by_kind_occurredAt", (q) => q.eq("kind", args.kind!))
          .order("desc")
          .paginate({ cursor: args.cursor ?? null, numItems: limit })
      : await ctx.db
          .query("platformEvents")
          .withIndex("by_occurredAt")
          .order("desc")
          .paginate({ cursor: args.cursor ?? null, numItems: limit });
    return {
      ...page,
      page: page.page.map((event) => ({
        id: event._id,
        organizationId: event.organizationId ?? null,
        kind: event.kind,
        feature: event.feature ?? null,
        action: event.action ?? null,
        runtime: event.runtime ?? null,
        appVersion: event.appVersion ?? null,
        releaseKind: event.releaseKind ?? null,
        releaseVersion: event.releaseVersion ?? null,
        assetGroup: event.assetGroup ?? null,
        errorCode: event.errorCode ?? null,
        count: event.count,
        occurredAt: event.occurredAt,
      })),
    };
  },
});

export const recordAdminExport = mutation({
  args: {
    format: v.union(v.literal("pdf"), v.literal("xlsx"), v.literal("csv")),
    range: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requirePlatformAdmin(ctx);
    const occurredAt = Date.now();
    await ctx.db.insert("platformEvents", {
      actorId: admin.userId,
      kind: "platform_admin_export",
      feature: "platform",
      action: "exported",
      source: args.format,
      count: 1,
      occurredAt,
    });
    await recordTelemetryRollups(ctx, {
      occurredAt,
      metric: "platform_admin_export",
      feature: "platform",
      action: "exported",
    });
    await writeAuditLog(ctx, {
      actorId: admin.userId,
      action: "platform_analytics_exported",
      entityType: "platformAnalytics",
      metadata: { format: args.format, range: args.range.slice(0, 16) },
    });
  },
});
