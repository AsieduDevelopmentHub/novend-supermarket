import { safeInternalPath } from "@/lib/auth/safe-return-path";

const ENTITY_ID = /^[A-Za-z0-9_-]{1,128}$/;
const ENCODED_PATH_SEPARATOR_OR_DOT = /%(?:2f|5c|2e)/i;
const DOT_PATH_SEGMENT = /(?:^|\/)\.{1,2}(?:\/|$)/;

function validEntityId(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 1) return null;
  try {
    const id = decodeURIComponent(segments[0] ?? "");
    return ENTITY_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

function customSchemeRoute(parsed: URL): string | null {
  const host = parsed.hostname.toLowerCase();
  if (host === "dashboard" && parsed.pathname === "") return "/dashboard";
  if (host === "sales" && parsed.pathname === "") return "/sales";

  const id = validEntityId(parsed.pathname);
  if (!id) return null;
  if (host === "sale" || host === "order") return `/orders/${id}`;
  if (host === "product") return `/products/${id}`;
  return null;
}

/**
 * Convert a native app URL into a validated internal route.
 * Custom links use a small route allowlist. HTTPS links must use the exact
 * currently loaded Novend origin and cannot carry redirect-style parameters.
 */
export function parseMobileDeepLink(url: string, trustedOrigin: string): string | null {
  const raw = url.trim();
  if (
    !raw ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    ENCODED_PATH_SEPARATOR_OR_DOT.test(raw) ||
    DOT_PATH_SEGMENT.test(raw)
  ) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;

  if (parsed.protocol === "novend:") {
    return customSchemeRoute(parsed);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  try {
    const trusted = new URL(trustedOrigin);
    if (parsed.origin !== trusted.origin) return null;
  } catch {
    return null;
  }

  return safeInternalPath(parsed.pathname);
}
