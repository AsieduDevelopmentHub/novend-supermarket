/**
 * Org-wide temporary full_sync boost — PEAS cloudMode stays unchanged.
 * Used when a new or empty till needs every device to flush/pull briefly.
 */

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { writeAuditLog } from "./audit";
import {
  cloudSyncBoostTtlMs,
  normalizeCloudMode,
  shouldApplyCloudSyncBoost,
  type CloudMode,
} from "./cloudMode";
import { bumpEntitlementVersion } from "./entitlementVersion";
import { resolveOrganizationCloudSyncBoostTtlMinutes } from "./platformDefaults";

export type CloudSyncBoostReason =
  | "new_device"
  | "reactivate_device"
  | "empty_device"
  | "manual";

export type EnsureCloudSyncBoostResult = {
  boosted: boolean;
  syncBoostUntil: number | null;
  plannedCloudMode: CloudMode;
  effectiveCloudMode: CloudMode;
};

export async function ensureCloudSyncBoost(
  ctx: MutationCtx,
  organization: Doc<"organizations">,
  input: {
    actorId: Id<"users">;
    reason: CloudSyncBoostReason;
  },
): Promise<EnsureCloudSyncBoostResult> {
  const now = Date.now();
  const planned = normalizeCloudMode(organization.cloudMode);
  const { effectiveMinutes } = await resolveOrganizationCloudSyncBoostTtlMinutes(
    ctx,
    organization,
  );
  const decision = shouldApplyCloudSyncBoost({
    planned,
    boostUntil: organization.cloudSyncBoostUntil,
    now,
    ttlMs: cloudSyncBoostTtlMs(effectiveMinutes),
  });

  if (!decision.apply) {
    const until =
      typeof organization.cloudSyncBoostUntil === "number" &&
      organization.cloudSyncBoostUntil > now
        ? organization.cloudSyncBoostUntil
        : null;
    return {
      boosted: false,
      syncBoostUntil: until,
      plannedCloudMode: planned,
      effectiveCloudMode: until ? "full_sync" : planned,
    };
  }

  await ctx.db.patch(organization._id, {
    cloudSyncBoostUntil: decision.until,
    cloudSyncBoostStartedAt: now,
    cloudSyncBoostReason: input.reason,
    updatedAt: now,
  });
  await bumpEntitlementVersion(ctx, organization._id);
  await writeAuditLog(ctx, {
    organizationId: organization._id,
    actorId: input.actorId,
    action: "cloud_sync_boost_started",
    entityType: "organizations",
    entityId: organization._id,
    metadata: {
      reason: input.reason,
      plannedCloudMode: planned,
      syncBoostUntil: decision.until,
      ttlMinutes: effectiveMinutes,
    },
  });

  return {
    boosted: true,
    syncBoostUntil: decision.until,
    plannedCloudMode: planned,
    effectiveCloudMode: "full_sync",
  };
}
