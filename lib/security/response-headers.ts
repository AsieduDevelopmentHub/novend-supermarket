/**
 * Shared HTTP security headers for the Next.js edge proxy.
 *
 * Keep CSP nonce wiring in `proxy.ts` (request + response). This module owns
 * the remaining defense-in-depth headers so they can be unit-tested without
 * booting Convex auth middleware.
 */

export type SecurityHeaderEnv = {
  NODE_ENV?: string;
};

/** Production-only HSTS. Do not enable `preload` until every hostname is HTTPS forever. */
export const PRODUCTION_HSTS = "max-age=31536000; includeSubDomains";

/**
 * Cross-origin isolation evaluation (P1-3):
 * - COOP `same-origin` — safe: Novend does not rely on cross-origin `window.opener`.
 * - CORP `same-origin` — safe for document/HTML responses; Convex image/API
 *   responses are separate origins with their own headers.
 * - COEP — **deferred**. `require-corp` would break third-party assets (e.g.
 *   Convex file URLs) that do not send CORP. Revisit only with a full embedder
 *   isolation plan.
 */
export const CROSS_ORIGIN_OPENER_POLICY = "same-origin";
export const CROSS_ORIGIN_RESOURCE_POLICY = "same-origin";

export type SecurityHeaderMap = Record<string, string>;

export function buildSecurityHeaders(env: SecurityHeaderEnv = process.env): SecurityHeaderMap {
  const headers: SecurityHeaderMap = {
    "X-DNS-Prefetch-Control": "on",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // camera=(self) — product Take Photo (desktop + PWA). Mic/geo/payment stay blocked.
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": CROSS_ORIGIN_OPENER_POLICY,
    "Cross-Origin-Resource-Policy": CROSS_ORIGIN_RESOURCE_POLICY,
  };

  if (env.NODE_ENV === "production") {
    headers["Strict-Transport-Security"] = PRODUCTION_HSTS;
  }

  return headers;
}

export function applySecurityHeaders(
  target: { headers: { set: (name: string, value: string) => void } },
  env: SecurityHeaderEnv = process.env,
) {
  for (const [name, value] of Object.entries(buildSecurityHeaders(env))) {
    target.headers.set(name, value);
  }
  return target;
}
