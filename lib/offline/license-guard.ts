import { loadLicenseSnapshot } from "./license";

/**
 * Blocks local-first writes when the cached licence is read-only (suspended,
 * expired, disabled, stale offline cache, or owner-scheduled closure).
 *
 * Convex still enforces the same rules on sync — this prevents phantom sales in
 * IndexedDB while the business is meant to be paused.
 */
export async function assertLocalWriteAllowed(): Promise<void> {
  const cached = await loadLicenseSnapshot();
  if (!cached) return;
  if (!cached.access.canWrite) {
    throw new Error(cached.access.reason ?? "This business cannot record new activity right now.");
  }
}
