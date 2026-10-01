import { describeOutboxConflict } from "./outbox-labels";
import { shouldMarkOutboxFailed } from "./outbox-policy";
import { isAuthRequiredError, isSyncDependencyWait, isTransientSyncPlaceholder } from "./sync-errors";
import type { OutboxRow } from "./types";

/**
 * True when this row needs cashier attention as a conflict (business / entitlement /
 * exhausted retries) — not auth or dependency waits.
 */
export function isDisplayedConflict(row: OutboxRow): boolean {
  if (row.status === "blocked_by_entitlement") return true;

  const looksFailed =
    row.status === "failed" ||
    Boolean(row.lastError && shouldMarkOutboxFailed(row.attempts, row.lastError));
  if (!looksFailed) return false;

  // Auth / dependency waits can sit as `failed` from older builds — still Waiting.
  return describeOutboxConflict(row).kind !== "waiting";
}

/** Failed (or pending) rows blocked only on cloud sign-in. */
export function isOutboxAuthWait(row: OutboxRow): boolean {
  return Boolean(row.lastError && isAuthRequiredError(row.lastError));
}

/** Failed rows that should reopen to pending on the next drain. */
export function shouldReopenFailedOutboxWait(lastError: string | null | undefined): boolean {
  if (!lastError) return false;
  return (
    isSyncDependencyWait(lastError) ||
    isAuthRequiredError(lastError) ||
    isTransientSyncPlaceholder(lastError)
  );
}
