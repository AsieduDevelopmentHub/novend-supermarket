import {
  isAuthRequiredError,
  isSyncBusinessConflict,
  isSyncDependencyWait,
  isTransientSyncPlaceholder,
} from "./sync-errors";

/** Outbox upload attempts before surfacing "requires attention" in the UI. */
export const MAX_OUTBOX_UPLOAD_ATTEMPTS = 8;

/** Immediate terminal failures — no point retrying validation / permission errors. */
export function isDefinitiveBusinessConflict(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("forbidden") ||
    m.includes("not authorized") ||
    m.includes("insufficient stock") ||
    m.includes("not enough stock") ||
    m.includes("already exists") ||
    m.includes("already recorded") ||
    m.includes("must be") ||
    m.includes("invalid") ||
    m.includes("required") ||
    m.includes("no longer supported") ||
    m.includes("cannot record new activity") ||
    m.includes("read-only") ||
    m.includes("suspended") ||
    m.includes("disabled")
  );
}

/**
 * Whether an outbox row should move to `failed` after this upload attempt.
 * Transient/network/auth errors keep retrying until the attempt budget is exhausted.
 */
export function shouldMarkOutboxFailed(attempts: number, message: string) {
  if (isSyncDependencyWait(message)) return false;
  if (isAuthRequiredError(message)) return false;
  if (isTransientSyncPlaceholder(message)) return false;
  if (isDefinitiveBusinessConflict(message)) return true;
  if (isSyncBusinessConflict(message) && attempts >= 3) return true;
  return attempts >= MAX_OUTBOX_UPLOAD_ATTEMPTS;
}
