/**
 * Deployment-wide Super Admin defaults (singleton `key: "global"`).
 * Org fields override these when set; missing → hard-coded product defaults.
 */

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  DEFAULT_CLOUD_SYNC_BOOST_TTL_MINUTES,
  normalizeCloudSyncBoostTtlMinutes,
  resolveCloudSyncBoostTtlMinutes,
  type CloudSyncBoostTtlMinutes,
} from "./cloudMode";

type DefaultsCtx = QueryCtx | MutationCtx;

export async function readPlatformDefaults(
  ctx: DefaultsCtx,
): Promise<Doc<"platformDefaults"> | null> {
  return await ctx.db
    .query("platformDefaults")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
}

export async function ensurePlatformDefaults(
  ctx: MutationCtx,
): Promise<Doc<"platformDefaults">> {
  const existing = await readPlatformDefaults(ctx);
  if (existing) return existing;
  const id = await ctx.db.insert("platformDefaults", {
    key: "global",
    cloudSyncBoostTtlMinutes: DEFAULT_CLOUD_SYNC_BOOST_TTL_MINUTES,
    updatedAt: Date.now(),
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Failed to create platform defaults");
  return created;
}

export async function resolveGlobalCloudSyncBoostTtlMinutes(
  ctx: DefaultsCtx,
): Promise<CloudSyncBoostTtlMinutes> {
  const defaults = await readPlatformDefaults(ctx);
  if (defaults?.cloudSyncBoostTtlMinutes == null) {
    return DEFAULT_CLOUD_SYNC_BOOST_TTL_MINUTES;
  }
  return normalizeCloudSyncBoostTtlMinutes(defaults.cloudSyncBoostTtlMinutes);
}

/** Effective catch-up TTL for an organization (org override → global → 30m). */
export async function resolveOrganizationCloudSyncBoostTtlMinutes(
  ctx: DefaultsCtx,
  organization: Pick<Doc<"organizations">, "cloudSyncBoostTtlMinutes">,
): Promise<{
  effectiveMinutes: CloudSyncBoostTtlMinutes;
  organizationMinutes: CloudSyncBoostTtlMinutes | null;
  globalMinutes: CloudSyncBoostTtlMinutes;
}> {
  const globalMinutes = await resolveGlobalCloudSyncBoostTtlMinutes(ctx);
  const raw = organization.cloudSyncBoostTtlMinutes;
  const organizationMinutes =
    typeof raw === "number" ? normalizeCloudSyncBoostTtlMinutes(raw) : null;
  return {
    effectiveMinutes: resolveCloudSyncBoostTtlMinutes({
      organizationMinutes,
      globalMinutes,
    }),
    organizationMinutes,
    globalMinutes,
  };
}
