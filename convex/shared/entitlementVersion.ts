/**
 * Entitlement version bumping.
 *
 * `organizations.entitlementVersion` is a monotonic counter that increases every
 * time anything a client caches as "the licence" changes: plan, status, limit
 * overrides, cloud mode, or the backup/monitoring entitlement flags. Offline
 * clients compare their cached version against the latest heartbeat / licence
 * snapshot to know a refresh is due. Missing values are treated as 0.
 *
 * See docs/architecture/CLOUD_MODE_PLAN_V2.md (§38, §41).
 */

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** Reads the current entitlement version, treating a missing value as 0. */
export function currentEntitlementVersion(org: { entitlementVersion?: number }): number {
  return org.entitlementVersion ?? 0;
}

/**
 * Increments the organization's entitlement version and touches `updatedAt`.
 * Returns the new version. No-op (returns 0) if the organization is missing.
 */
export async function bumpEntitlementVersion(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<number> {
  const org = await ctx.db.get(organizationId);
  if (!org) return 0;
  const next = currentEntitlementVersion(org) + 1;
  await ctx.db.patch(organizationId, { entitlementVersion: next, updatedAt: Date.now() });
  return next;
}
