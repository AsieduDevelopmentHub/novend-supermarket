import { describeOutboxConflict } from "./outbox-labels";
import { shouldMarkOutboxFailed } from "./outbox-policy";
import {
  isAuthRequiredError,
  isOpaqueServerDump,
  isSyncDependencyWait,
  isTransientSyncPlaceholder,
} from "./sync-errors";
import type { OutboxRow } from "./types";

/**
 * True when this row needs cashier attention as a conflict (business / entitlement /
 * exhausted retries) — not auth, network blips, or dependency waits.
 *
 * "Upload interrupted" / Sync failed must stay in Waiting so background drain can
 * finish the upload after a short distraction, without looking like a permanent
 * rejection.
 */
export function isDisplayedConflict(row: OutboxRow): boolean {
  if (row.status === "blocked_by_entitlement") return true;

  const looksFailed =
    row.status === "failed" ||
    Boolean(row.lastError && shouldMarkOutboxFailed(row.attempts, row.lastError));
  if (!looksFailed) return false;

  return describeOutboxConflict(row).kind === "business";
}

/** Failed (or pending) rows blocked only on cloud sign-in. */
export function isOutboxAuthWait(row: OutboxRow): boolean {
  return Boolean(row.lastError && isAuthRequiredError(row.lastError));
}

/** A printed receipt the server parked for stock. The next drain uploads it. */
export function isStockShortageRejection(message: string) {
  const m = message.toLowerCase();
  return m.includes("not enough stock") || m.includes("insufficient stock");
}

/** Failed rows that should reopen to pending on the next drain. */
export function shouldReopenFailedOutboxWait(lastError: string | null | undefined): boolean {
  if (!lastError) return false;
  return (
    isSyncDependencyWait(lastError) ||
    isAuthRequiredError(lastError) ||
    isTransientSyncPlaceholder(lastError) ||
    isOpaqueServerDump(lastError) ||
    isStockShortageRejection(lastError)
  );
}
