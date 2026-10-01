/** Max future skew vs server clock (clock ahead / timezone blips). */
export const SALE_CLIENT_FUTURE_SKEW_MS = 5 * 60 * 1000;
/** Max age of a till-stamped sale vs server now when syncing. */
export const SALE_CLIENT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Resolve business `completedAt` from an optional till stamp.
 * Returns serverNow when the client stamp is missing or out of bounds.
 */
export function resolveSaleCompletedAt(
  clientCompletedAt: number | undefined,
  serverNow = Date.now(),
): { completedAt: number; usedClientStamp: boolean } {
  if (clientCompletedAt === undefined) {
    return { completedAt: serverNow, usedClientStamp: false };
  }
  if (!Number.isFinite(clientCompletedAt)) {
    throw new Error("Invalid sale completion time");
  }
  if (clientCompletedAt - serverNow > SALE_CLIENT_FUTURE_SKEW_MS) {
    throw new Error("Sale completion time is too far in the future. Check this till’s date & time.");
  }
  if (serverNow - clientCompletedAt > SALE_CLIENT_MAX_AGE_MS) {
    throw new Error("Sale completion time is too old to sync. Check this till’s date & time.");
  }
  return { completedAt: clientCompletedAt, usedClientStamp: true };
}
