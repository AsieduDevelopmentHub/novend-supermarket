import { toast } from "sonner";

export const OFFLINE_MESSAGE = "You're offline. Please connect to the internet and try again.";

export const SERVER_UNREACHABLE_MESSAGE =
  "Unable to reach the server. We'll sync automatically when you're back online.";

const LOAD_FAILED_MESSAGE = "We couldn't load this data. Please try again.";

const UNKNOWN_MESSAGE = "Something went wrong. Please try again.";

const OFFLINE_PATTERNS = [
  "err_internet_disconnected",
  "err_network_changed",
  "err_address_unreachable",
  "err_name_not_resolved",
];

const SERVER_PATTERNS = [
  "err_connection_reset",
  "err_connection_refused",
  "err_connection_timed_out",
  "err_failed",
  "failed to fetch",
  "networkerror",
  "network request failed",
  "load failed",
  "econnrefused",
  "enotfound",
  "timed out",
  "timeout",
  "net::",
  "network_error",
];

function rawErrorText(error: unknown): string {
  return error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
}

function isOfflineError(error: unknown): boolean {
  const lower = rawErrorText(error).toLowerCase();
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (OFFLINE_PATTERNS.some((pattern) => lower.includes(pattern))) return true;
  return lower.includes("you are offline") || lower === "offline";
}

export function isConnectivityError(error: unknown): boolean {
  if (isOfflineError(error)) return true;
  const lower = rawErrorText(error).toLowerCase();
  if (SERVER_PATTERNS.some((pattern) => lower.includes(pattern))) return true;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return lower.includes("fetch") || lower.includes("network") || lower.includes("convex");
  }
  return false;
}

/**
 * Convert backend / Convex errors into short messages safe to show end users.
 * Full details are logged for debugging.
 */
export function toUserMessage(error: unknown, fallback = UNKNOWN_MESSAGE): string {
  console.error(error);

  if (isOfflineError(error)) return OFFLINE_MESSAGE;
  if (isConnectivityError(error)) {
    const lower = rawErrorText(error).toLowerCase();
    if (lower.includes("failed to fetch") || lower.includes("load failed")) {
      return LOAD_FAILED_MESSAGE;
    }
    return SERVER_UNREACHABLE_MESSAGE;
  }

  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (!raw.trim()) return fallback;

  let message = raw
    .replace(/\[CONVEX[^\]]*\]\s*/gi, "")
    .replace(/\[Request ID:[^\]]*\]\s*/gi, "")
    .replace(/Server Error\s*/gi, "")
    .replace(/Called by client\s*/gi, "")
    .trim();

  const uncaught = message.match(/Uncaught (?:Error|ConvexError):\s*([^\n]+)/i);
  if (uncaught?.[1]) {
    message = uncaught[1].trim();
  } else {
    const plain = message.match(/(?:^|\n)(?:Error|ConvexError):\s*([^\n]+)/i);
    if (plain?.[1]) message = plain[1].trim();
  }

  message = message.replace(/\s+/g, " ").trim();

  // Drop trailing Convex location / stack crumbs.
  message = message.replace(/\s+at\s+handler\b.*$/i, "").trim();

  const lower = message.toLowerCase();
  const rawLower = rawErrorText(error).toLowerCase();

  // Rate limit / lockout first — Auth often wraps these as opaque codes or
  // credential-like strings; never show "wrong password" for throttling.
  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("too many attempts") ||
    lower.includes("too many failed") ||
    lower.includes("try again later") ||
    lower.includes("temporarily locked") ||
    lower.includes("account locked") ||
    lower.includes("login locked") ||
    lower.includes("locked until") ||
    /\bthrottl/.test(lower) ||
    /\b(too_many|ratelimit|rate_limit)\b/.test(lower) ||
    rawLower.includes("rate limit") ||
    rawLower.includes("too many requests") ||
    rawLower.includes("too many attempts") ||
    /\b(too_many_requests|ratelimit|rate_limit)\b/.test(rawLower)
  ) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  if (
    lower.includes("invalidsecret") ||
    lower.includes("invalidaccountid") ||
    lower.includes("invalid credentials") ||
    lower.includes("could not verify") ||
    lower.includes("incorrect password") ||
    lower.includes("wrong password")
  ) {
    if (lower.includes("invalidaccountid")) {
      return "No account found for that email.";
    }
    return "Incorrect email or password.";
  }
  if (/already exists/i.test(lower) && (lower.includes("account") || lower.includes("email"))) {
    return "An account with this email already exists. Use a different email, or reset the password for the existing user.";
  }
  if (
    lower.includes("unauthenticated") ||
    lower.includes("not authenticated") ||
    lower.includes("signed in") ||
    lower.includes("missing session") ||
    lower.includes("[unauthorized]") ||
    lower.trim() === "unauthorized"
  ) {
    return "Please sign in again to continue.";
  }
  if (lower.includes("platform administrator")) {
    return "This account is not a Novend platform administrator on this Convex deployment. Confirm platformAdmins for your user on the same deployment as NEXT_PUBLIC_CONVEX_URL.";
  }
  if (
    lower.includes("forbidden") ||
    lower.includes("not authorized") ||
    lower.includes("access denied")
  ) {
    return "You don’t have permission to do that.";
  }
  if (lower.includes("auth provider discovery")) {
    return SERVER_UNREACHABLE_MESSAGE;
  }
  if (isOfflineError(message)) return OFFLINE_MESSAGE;
  if (isConnectivityError(message)) return SERVER_UNREACHABLE_MESSAGE;
  if (
    lower.includes("argumentvalidation") ||
    lower.includes("validator") ||
    lower.includes("invalid_argument")
  ) {
    return "This change could not sync. Open the record, check the details, and save again.";
  }
  if (
    lower.includes("could not find public function") ||
    lower.includes("could not find function")
  ) {
    return fallback;
  }

  // Opaque Auth / Convex error codes (InvalidSecret, etc.)
  if (/^[A-Z][A-Za-z0-9_]+$/.test(message) && message.length <= 48) {
    if (/TOO_MANY|RATE_LIMIT|THROTTL|LOCKED/i.test(message)) {
      return "Too many attempts. Please wait a moment and try again.";
    }
    if (/INVALIDACCOUNTID/i.test(message)) {
      return "No account found for that email.";
    }
    if (/INVALIDSECRET/i.test(message)) {
      return "Incorrect email or password.";
    }
    return fallback;
  }

  // Still looks like a framework dump.
  if (
    !message ||
    message.length > 160 ||
    /at\s+\S+\s+\(/.test(message) ||
    /\[convex/i.test(message) ||
    /request id/i.test(message)
  ) {
    return fallback;
  }

  // Allow intentional business messages we throw from Convex
  // (e.g. "SKU already exists"), after Convex wrappers are stripped.
  return message;
}

/** Show a sanitized error toast (logs the raw error). Repeats replace instead of stacking. */
export function showError(error: unknown, fallback?: string) {
  const message = toUserMessage(error, fallback);
  const network = isConnectivityError(error) || isOfflineError(error);
  toast.error(message, {
    id: network ? "network" : message,
    duration: 6000,
  });
}
