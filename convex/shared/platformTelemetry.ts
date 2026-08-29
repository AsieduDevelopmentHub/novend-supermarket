import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export const TELEMETRY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export const TELEMETRY_FEATURES = [
  "dashboard",
  "sales",
  "products",
  "inventory",
  "reports",
  "users",
  "settings",
  "imports",
  "exports",
  "backup",
  "sync",
  "platform",
] as const;

export const TELEMETRY_ACTIONS = [
  "opened",
  "searched",
  "created",
  "completed",
  "exported",
  "imported",
  "failed",
  "pending",
  "retried",
  "installed",
  "dismissed",
] as const;

export type TelemetryRuntime = "web" | "pwa" | "electron" | "android" | "ios";

export function utcDay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function isTelemetryFeature(value: string): value is (typeof TELEMETRY_FEATURES)[number] {
  return (TELEMETRY_FEATURES as readonly string[]).includes(value);
}

export function isTelemetryAction(value: string): value is (typeof TELEMETRY_ACTIONS)[number] {
  return (TELEMETRY_ACTIONS as readonly string[]).includes(value);
}

export function clampTelemetryTimestamp(value: number | undefined, now = Date.now()): number {
  if (!value || !Number.isFinite(value)) return now;
  const lower = now - 24 * 60 * 60 * 1000;
  const upper = now + 5 * 60 * 1000;
  return Math.min(Math.max(value, lower), upper);
}

export function classifyReleaseAsset(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".exe")) return "windows-installer";
  if (lower.endsWith(".dmg")) return "macos-installer";
  if (lower.endsWith(".deb")) return "linux-deb";
  if (lower.endsWith(".appimage")) return "linux-appimage";
  if (lower.endsWith(".apk")) return "android-apk";
  if (lower.endsWith(".aab")) return "android-aab";
  if (lower.endsWith(".ipa")) return "ios-ipa";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "update-manifest";
  return "other";
}

async function incrementRollup(
  ctx: MutationCtx,
  day: string,
  metric: string,
  dimension: string,
  amount: number,
) {
  const existing = await ctx.db
    .query("platformDailyRollups")
    .withIndex("by_day_metric_dimension", (q) =>
      q.eq("day", day).eq("metric", metric).eq("dimension", dimension),
    )
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, {
      value: existing.value + amount,
      updatedAt: Date.now(),
    });
    return;
  }
  await ctx.db.insert("platformDailyRollups", {
    day,
    metric,
    dimension,
    value: amount,
    updatedAt: Date.now(),
  });
}

export async function recordTelemetryRollups(
  ctx: MutationCtx,
  args: {
    occurredAt: number;
    metric: string;
    count?: number;
    runtime?: TelemetryRuntime;
    feature?: string;
    action?: string;
    assetGroup?: string;
    releaseVersion?: string;
    source?: string;
  },
) {
  const day = utcDay(args.occurredAt);
  const count = args.count ?? 1;
  await incrementRollup(ctx, day, args.metric, "all", count);
  if (args.runtime) {
    await incrementRollup(ctx, day, args.metric, `runtime:${args.runtime}`, count);
  }
  if (args.feature) {
    await incrementRollup(ctx, day, args.metric, `feature:${args.feature}`, count);
  }
  if (args.action) {
    await incrementRollup(ctx, day, args.metric, `action:${args.action}`, count);
  }
  if (args.assetGroup) {
    await incrementRollup(ctx, day, args.metric, `asset:${args.assetGroup}`, count);
  }
  if (args.releaseVersion) {
    await incrementRollup(ctx, day, args.metric, `version:${args.releaseVersion}`, count);
  }
  if (args.source) {
    await incrementRollup(ctx, day, args.metric, `source:${args.source}`, count);
  }
}

export async function recordDailyActiveUser(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    organizationId?: Id<"organizations">;
    runtime: TelemetryRuntime;
    appVersion?: string;
    occurredAt?: number;
  },
) {
  const now = clampTelemetryTimestamp(args.occurredAt);
  const day = utcDay(now);
  const existing = await ctx.db
    .query("platformDailyActiveUsers")
    .withIndex("by_user_day", (q) => q.eq("userId", args.userId).eq("day", day))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, {
      runtime: args.runtime,
      appVersion: args.appVersion?.slice(0, 32),
      lastSeenAt: now,
    });
    return;
  }

  let firstOrganizationUserToday = false;
  if (args.organizationId) {
    firstOrganizationUserToday =
      (
        await ctx.db
          .query("platformDailyActiveUsers")
          .withIndex("by_organization_day", (q) =>
            q.eq("organizationId", args.organizationId).eq("day", day),
          )
          .first()
      ) === null;
  }

  await ctx.db.insert("platformDailyActiveUsers", {
    day,
    userId: args.userId,
    organizationId: args.organizationId,
    runtime: args.runtime,
    appVersion: args.appVersion?.slice(0, 32),
    firstSeenAt: now,
    lastSeenAt: now,
  });
  await incrementRollup(ctx, day, "active_users", "all", 1);
  await incrementRollup(ctx, day, "active_users", `runtime:${args.runtime}`, 1);
  if (firstOrganizationUserToday) {
    await incrementRollup(ctx, day, "active_organizations", "all", 1);
  }
}
