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
 * Convex / browser dumps with no usable business reason. Treating these as
 * conflicts marks the row failed, Sync Center reopens it every poll, and the
 * till burns attempts (e.g. 21 in a few minutes) while the sale already sits
 * in Orders on this device.
 */
export function isOpaqueServerDump(message: string) {
  const m = message.trim();
  if (!m) return true;
  if (isTransientSyncPlaceholder(m)) return true;
  const lower = m.toLowerCase();
  if (lower.includes("[convex") || lower.includes("request id")) return true;
  if (/at\s+\S+\s+\(/.test(m)) return true;
  if (m.length > 160 && !/\b(stock|sku|forbidden|exist|invalid|required)\b/i.test(m)) {
    return true;
  }
  return false;
}

/**
 * Keep the server's reason for Sync Center. `toUserMessage` collapses unknown
 * Convex dumps to "Sync failed", which hides why a sale will not upload.
 */
export function syncFailureMessage(error: unknown, friendly: string): string {
  if (friendly.trim() && friendly.trim().toLowerCase() !== "sync failed") return friendly.trim();
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const cleaned = raw
    .replace(/\[CONVEX[^\]]*\]\s*/gi, "")
    .replace(/\[Request ID:[^\]]*\]\s*/gi, "")
    .replace(/Server Error\s*/gi, "")
    .replace(/Called by client\s*/gi, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("at "))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Sync failed";
  return cleaned.length > 180 ? `${cleaned.slice(0, 177)}...` : cleaned;
}

/**
 * Convex retries these itself when it can. When one reaches the outbox, the row
 * must stay pending. Several tills uploading the same branch at close produce
 * this, and it is not a stock or validation conflict.
 */
export function isRetryableServerConflict(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("changed while this mutation") ||
    m.includes("optimistic concurrency") ||
    m.includes("optimisticconcurrency")
  );
}

/**
 * Server rejections the cashier must review. Network / rate-limit / auth
 * failures stay pending and retry. Validation errors (expiry, SKU, stock, …)
 * must not sit in Waiting and must not stop the rest of the queue.
 */
export function isSyncBusinessConflict(message: string) {
  if (!message.trim()) return false;
  if (isConnectivityError(new Error(message))) return false;
  if (isRetryableServerConflict(message)) return false;
  if (isSyncDependencyWait(message)) return false;
  if (isAuthRequiredError(message)) return false;
  if (isTransientSyncPlaceholder(message)) return false;
  if (isOpaqueServerDump(message)) return false;
  const m = message.toLowerCase();
  if (
    m.includes("too many requests") ||
    m.includes("rate limit") ||
    m.includes("try again later") ||
    m.includes("server overloaded") ||
    m.includes("temporarily unavailable") ||
    m.includes("we couldn't load") ||
    m.includes("unable to reach the server") ||
    m.includes("you're offline")
  ) {
    return false;
  }
  return true;
}
