import { isConnectivityError } from "@/lib/errors";

/** Outbox rows blocked on another local create (category, supplier, product). */
export function isSyncDependencyWait(message: string) {
  return message.toLowerCase().includes("finish syncing");
}

/**
 * Offline shell / expired JWT — keep events pending until the till signs in
 * online. Never treat these as discardable "Needs a fix" conflicts.
 *
 * Do not treat bare "Sync failed" as auth — that is the generic catch fallback
 * when a mutation throws without a useful message, and it commonly appears while
 * the till is already cloud-authenticated (other uploads succeeding).
 */
export function isAuthRequiredError(message: string) {
  const m = message.trim().toLowerCase();
  if (!m) return false;
  return (
    m.includes("not authenticated") ||
    m.includes("unauthenticated") ||
    m.includes("authentication required") ||
    m.includes("must be logged in") ||
    m.includes("no auth") ||
    (m.includes("sign in") && (m.includes("again") || m.includes("online")))
  );
}

/** Generic drain placeholders — retry, do not file as business conflicts. */
export function isTransientSyncPlaceholder(message: string) {
  return message.trim().toLowerCase() === "sync failed";
}

/**
 * Server rejections the cashier must review. Network / rate-limit / auth
 * failures stay pending and retry. Validation errors (expiry, SKU, stock, …)
 * must not sit in Waiting and must not stop the rest of the queue.
 */
export function isSyncBusinessConflict(message: string) {
  if (!message.trim()) return false;
  if (isConnectivityError(new Error(message))) return false;
  if (isSyncDependencyWait(message)) return false;
  if (isAuthRequiredError(message)) return false;
  if (isTransientSyncPlaceholder(message)) return false;
  const m = message.toLowerCase();
  if (
    m.includes("too many requests") ||
    m.includes("rate limit") ||
    m.includes("try again later") ||
    m.includes("server overloaded") ||
    m.includes("temporarily unavailable")
  ) {
    return false;
  }
  return true;
}
