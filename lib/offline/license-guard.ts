import { loadOfflineLicenseState } from "./license";
import { getOfflineDb } from "./db";
import { limitReachedMessage, type LimitResource } from "@/convex/shared/plans";

/**
 * Blocks local-first writes when the cached licence is read-only (suspended,
 * expired, disabled, stale offline cache, or owner-scheduled closure).
 *
 * Convex still enforces the same rules on sync — this prevents phantom sales in
 * IndexedDB while the business is meant to be paused.
 */
export async function assertLocalWriteAllowed(): Promise<void> {
  const license = await loadOfflineLicenseState();
  if (!license.access.canWrite) {
    throw new Error(license.access.reason ?? "This business cannot record new activity right now.");
  }
}

/** Resources whose plan limit can be enforced against local Dexie counts. */
type LocalCapacityResource = Extract<LimitResource, "products" | "users" | "branches">;

async function countLocalResource(resource: LocalCapacityResource): Promise<number> {
  const db = await getOfflineDb();
  if (!db) return 0;
  switch (resource) {
    case "products":
      return await db.products.filter((row) => row.status !== "archived").count();
    case "users":
      return await db.users.count();
    case "branches":
      return await db.branches.count();
  }
}

/**
 * Local-first mirror of `assertWithinLimit`. Reads the cached licence limits and
 * counts local rows so an offline create is refused before it is queued, matching
 * the server-side plan enforcement. Unknown, missing, or corrupt licence state is
 * rejected by the write gate rather than deferred as a future sync conflict.
 *
 * See docs/architecture/CLOUD_MODE_PLAN_V2.md (§38) and CLOUD_MODE_PLAN_V1 offline gates.
 */
export async function assertLocalCapacity(
  resource: LocalCapacityResource,
  additional = 1,
): Promise<void> {
  const license = await loadOfflineLicenseState();
  if (!license.access.canWrite || !license.snapshot) {
    throw new Error(license.access.reason ?? "This business cannot record new activity right now.");
  }
  const cached = license.snapshot;
  const limit = cached.limits[resource];
  if (limit === null || limit === undefined) return;
  const used = await countLocalResource(resource);
  if (used + additional > limit) {
    throw new Error(limitReachedMessage(cached.planKey, resource, limit));
  }
}
