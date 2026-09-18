/**
 * Deployment-wide platform aggregate (`platformStats` singleton).
 *
 * One row keyed `global` powers the Super Admin overview KPI cards so the
 * dashboard never scans every organization on load. Organization-lifecycle
 * counters (organization / active / plan / cloud-mode) are maintained
 * incrementally; the broader resource sums (device / branch / user / sale) are
 * filled by `rebuildPlatformStats`. See CLOUD_MODE_PLAN_V2.md (§11, §40).
 */

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { normalizeCloudMode, type CloudMode } from "./cloudMode";
import { resolvePlan } from "./plans";

const GLOBAL_KEY = "global" as const;

export type PlatformStats = Omit<Doc<"platformStats">, "_id" | "_creationTime">;

type Counters = Omit<PlatformStats, "key" | "updatedAt">;

const ZERO_COUNTERS: Counters = {
  organizationCount: 0,
  activeOrganizationCount: 0,
  fullSyncCount: 0,
  backupOnlyCount: 0,
  localOnlyCount: 0,
  basicPlanCount: 0,
  proPlanCount: 0,
  enterprisePlanCount: 0,
  lifetimePlanCount: 0,
  deviceCount: 0,
  branchCount: 0,
  userCount: 0,
  saleCount: 0,
};

type CounterField = keyof Counters;

function planCountField(planKey: string): CounterField {
  const key = resolvePlan(planKey).key;
  switch (key) {
    case "basic":
      return "basicPlanCount";
    case "pro":
      return "proPlanCount";
    case "enterprise":
      return "enterprisePlanCount";
    case "lifetime":
    default:
      return "lifetimePlanCount";
  }
}

function cloudModeField(mode: CloudMode): CounterField {
  switch (mode) {
    case "backup_only":
      return "backupOnlyCount";
    case "local_only":
      return "localOnlyCount";
    case "full_sync":
    default:
      return "fullSyncCount";
  }
}

async function loadStats(ctx: QueryCtx | MutationCtx): Promise<Doc<"platformStats"> | null> {
  return await ctx.db
    .query("platformStats")
    .withIndex("by_key", (q) => q.eq("key", GLOBAL_KEY))
    .unique();
}

/** Read the singleton for queries. Returns null when it has not been built yet. */
export async function readPlatformStats(
  ctx: QueryCtx | MutationCtx,
): Promise<PlatformStats | null> {
  const row = await loadStats(ctx);
  if (!row) return null;
  const { _id: _ignoredId, _creationTime: _ignoredTime, ...stats } = row;
  return stats;
}

/** Ensures the singleton exists, building it from a full scan when missing. */
export async function ensurePlatformStats(ctx: MutationCtx): Promise<Doc<"platformStats">> {
  const existing = await loadStats(ctx);
  if (existing) return existing;
  await rebuildPlatformStats(ctx);
  const created = await loadStats(ctx);
  if (!created) throw new Error("Failed to create platform stats singleton");
  return created;
}

/**
 * Applies signed deltas to the singleton, clamping counters at zero. Creates the
 * singleton (via a full rebuild) first when it does not exist, so the very first
 * increment cannot drift from a phantom empty baseline.
 */
export async function incrementPlatformStats(
  ctx: MutationCtx,
  deltas: Partial<Record<CounterField, number>>,
): Promise<void> {
  const row = await ensurePlatformStats(ctx);
  const patch: Partial<Counters> & { updatedAt: number } = { updatedAt: Date.now() };
  for (const [field, delta] of Object.entries(deltas) as [CounterField, number][]) {
    if (!delta) continue;
    patch[field] = Math.max(0, row[field] + delta);
  }
  await ctx.db.patch(row._id, patch);
}

/** New organization: increment organization / active / plan / cloud-mode counters. */
export async function onOrganizationProvisioned(
  ctx: MutationCtx,
  args: { planKey: string; cloudMode: CloudMode; status: string; branchCount?: number },
): Promise<void> {
  await incrementPlatformStats(ctx, {
    organizationCount: 1,
    activeOrganizationCount: args.status === "active" ? 1 : 0,
    [planCountField(args.planKey)]: 1,
    [cloudModeField(args.cloudMode)]: 1,
    branchCount: args.branchCount ?? 0,
  });
}

/** Status change: keep `activeOrganizationCount` aligned with `status === active`. */
export async function onOrganizationStatusChanged(
  ctx: MutationCtx,
  args: { from: string; to: string },
): Promise<void> {
  const wasActive = args.from === "active";
  const isActive = args.to === "active";
  if (wasActive === isActive) return;
  await incrementPlatformStats(ctx, { activeOrganizationCount: isActive ? 1 : -1 });
}

/** Plan change: move one organization between plan buckets. */
export async function onOrganizationPlanChanged(
  ctx: MutationCtx,
  args: { from: string; to: string },
): Promise<void> {
  const fromField = planCountField(args.from);
  const toField = planCountField(args.to);
  if (fromField === toField) return;
  await incrementPlatformStats(ctx, { [fromField]: -1, [toField]: 1 });
}

/** Cloud-mode change: move one organization between mode buckets. */
export async function onOrganizationCloudModeChanged(
  ctx: MutationCtx,
  args: { from: CloudMode; to: CloudMode },
): Promise<void> {
  const fromField = cloudModeField(args.from);
  const toField = cloudModeField(args.to);
  if (fromField === toField) return;
  await incrementPlatformStats(ctx, { [fromField]: -1, [toField]: 1 });
}

/**
 * Full repair: scans every organization once (plus the per-org stat rows for
 * device/branch/user/sale sums) and rewrites the singleton. Super Admin only.
 */
export async function rebuildPlatformStats(ctx: MutationCtx): Promise<PlatformStats> {
  const [organizations, orgStats, devices] = await Promise.all([
    ctx.db.query("organizations").collect(),
    ctx.db.query("organizationPlatformStats").collect(),
    ctx.db
      .query("devices")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect(),
  ]);

  const counters: Counters = { ...ZERO_COUNTERS };
  counters.organizationCount = organizations.length;
  counters.deviceCount = devices.length;

  for (const org of organizations) {
    if (org.status === "active") counters.activeOrganizationCount += 1;
    counters[cloudModeField(normalizeCloudMode(org.cloudMode))] += 1;
    counters[planCountField(org.planKey ?? "")] += 1;
  }

  for (const row of orgStats) {
    counters.branchCount += row.branchCount;
    counters.userCount += row.userCount;
    counters.saleCount += row.saleCount;
  }

  const now = Date.now();
  const existing = await loadStats(ctx);
  if (existing) {
    await ctx.db.patch(existing._id, { ...counters, updatedAt: now });
  } else {
    await ctx.db.insert("platformStats", { key: GLOBAL_KEY, ...counters, updatedAt: now });
  }
  return { key: GLOBAL_KEY, ...counters, updatedAt: now };
}
