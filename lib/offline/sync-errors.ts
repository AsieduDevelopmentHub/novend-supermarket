import { isConnectivityError } from "@/lib/errors";

/**
 * Server rejections the cashier must review. Network / rate-limit failures stay
 * pending and retry. Validation errors (expiry, SKU, stock, …) must not sit in
 * Waiting and must not stop the rest of the queue.
 */
export function isSyncBusinessConflict(message: string) {
  if (!message.trim()) return false;
  if (isConnectivityError(new Error(message))) return false;
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
