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

/** Drop Convex wrappers, request ids, and stack lines. Keep the cashier sentence. */
export function sanitizeSyncErrorMessage(raw: string): string {
  const uncaught = raw.match(/Uncaught (?:ConvexError|Error):\s*([^\n]+)/i)?.[1]?.trim() ?? "";
  return (uncaught || raw)
    .replace(/\[CONVEX[^\]]*\]\s*/gi, "")
    .replace(/\[Request ID:[^\]]*\]\s*/gi, "")
    .replace(/\bServer Error\b/gi, "")
    .replace(/Called by client/gi, "")
    .replace(/\s+at\s+handler\b[\s\S]*$/i, "")
    .replace(/\s+at\s+\S+\s+\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/^Uncaught (?:ConvexError|Error)\s*$/i, "")
    .trim();
}

/**
 * The radio itself is down, so further uploads in this pass will fail the same way.
 * A single sale that returned "Sync failed" or timed out must not use this — the
 * rest of the queue can still upload.
 */
export function transientFailureStopsDrain(message: string) {
  const lower = message.trim().toLowerCase();
  if (
    lower === "upload timed out" ||
    isTransientSyncPlaceholder(message) ||
    isOpaqueServerDump(message)
  ) {
    return false;
  }
  return isConnectivityError(new Error(message));
}

/**
 * Convex / browser dumps with no usable business reason. Treating these as
 * conflicts marks the row failed, Sync Center reopens it every poll, and the
 * till burns attempts (e.g. 21 in a few minutes) while the sale already sits
 * in Orders on this device.
 */
export function isOpaqueServerDump(message: string) {
  const m = sanitizeSyncErrorMessage(message);
  if (!m) return true;
  if (isTransientSyncPlaceholder(m)) return true;
  if (/^uncaught (?:convexerror|error)\b/i.test(m) && !/\b(stock|sku|forbidden|exist|invalid|required)\b/i.test(m)) {
    return true;
  }
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
function clipSyncReason(message: string): string {
  const cleaned = message.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.length > 180 ? `${cleaned.slice(0, 177)}...` : cleaned;
}

/** Convex often puts the cashier-facing reason on `data`, not `Error.message`. */
function convexDataMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const data = (error as { data?: unknown }).data;
  if (typeof data === "string") return data.trim();
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string") return message.trim();
  }
  return "";
}

export function syncFailureMessage(error: unknown, friendly: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const candidates = [convexDataMessage(error), friendly, raw];
  for (const candidate of candidates) {
    const cleaned = clipSyncReason(sanitizeSyncErrorMessage(candidate));
    if (cleaned && cleaned.toLowerCase() !== "sync failed") return cleaned;
  }
  const name = error instanceof Error ? error.name : "";
  if (name && name !== "Error" && name !== "ConvexError") return name;
  return "Sync failed";
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
    m.includes("you're offline") ||
    m.includes("timed out") ||
    m.includes("timeout")
  ) {
    return false;
  }
  return true;
}
