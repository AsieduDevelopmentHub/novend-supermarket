import { postLoginPath } from "@/lib/auth/post-login-path";

const AUTH_PAGES = new Set(["/login", "/signup", "/forgot-password", "/reset-password"]);

/**
 * App and platform path prefixes that may be restored after login or cold start.
 * Marketing, auth, and API paths are excluded.
 */
const ALLOWED_PREFIXES = [
  "/dashboard",
  "/sales",
  "/orders",
  "/returns",
  "/customers",
  "/products",
  "/inventory",
  "/wholesale",
  "/suppliers",
  "/reports",
  "/analytics",
  "/branches",
  "/users",
  "/settings",
  "/more",
  "/about",
  "/billing",
  "/onboarding",
  "/platform",
] as const;

function normalizeCandidate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (/^https?:\/\//i.test(trimmed)) return null;

  try {
    const url = new URL(trimmed, "http://novend.local");
    if (url.hostname !== "novend.local") return null;
    const path = url.pathname.replace(/\/$/, "") || "/";
    const search = url.search;
    return `${path}${search}`;
  } catch {
    return null;
  }
}

function pathAllowed(pathname: string): boolean {
  if (AUTH_PAGES.has(pathname) || pathname === "/") return false;
  return ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Returns a safe same-origin relative path, or `null` when the candidate is
 * external, auth-only, or outside the app/platform surface.
 */
export function safeInternalPath(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  const normalized = normalizeCandidate(candidate);
  if (!normalized) return null;
  const pathname = normalized.split("?")[0] ?? normalized;
  if (!pathAllowed(pathname)) return null;
  return normalized;
}

export type PostAuthUser = {
  isPlatformAdmin?: boolean | null;
  needsOnboarding?: boolean | null;
  needsProfile?: boolean | null;
} | null;

/**
 * Session-isolated post-login destination. Platform administrators open the
 * platform console. Onboarding wins for tenant users who still need a business.
 * Everyone else starts at Dashboard.
 */
export function resolvePostAuthPath(user: PostAuthUser, _next?: string | null): string {
  void _next;
  return postLoginPath(user);
}

/** Build `/login?next=…` when redirecting an unauthenticated deep link. */
export function loginPathWithNext(pathname: string, search = ""): string {
  const candidate = `${pathname}${search}`;
  const safe = safeInternalPath(candidate);
  if (!safe) return "/login";
  // Cap/Electron cold start appends fromBoot=1; keep that off the return path.
  let next = safe;
  try {
    const url = new URL(safe, "http://novend.local");
    url.searchParams.delete("fromBoot");
    const path = url.pathname.replace(/\/$/, "") || "/";
    const q = url.searchParams.toString();
    next = q ? `${path}?${q}` : path;
  } catch {
    /* keep safe */
  }
  const params = new URLSearchParams();
  params.set("next", next);
  // Preserve boot marker so the login screen can fall back to an offline session.
  try {
    const incoming = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    if (incoming.get("fromBoot") === "1") params.set("fromBoot", "1");
  } catch {
    /* ignore */
  }
  return `/login?${params.toString()}`;
}
