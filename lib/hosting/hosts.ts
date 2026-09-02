/**
 * Host split between public marketing and the POS app.
 *
 * Unsplit / single-origin deployments leave marketing URL unset (or equal to the
 * app URL). In that case authenticated `/` still redirects into the app — today's
 * Cap / Electron / Vercel behavior.
 */

export function hostnameFromOrigin(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Strip port; keep subdomain. `www.` is treated as equivalent to the apex. */
export function normalizeHostname(host: string): string {
  const withoutPort = host.split(":")[0]?.toLowerCase() ?? "";
  return withoutPort.replace(/^www\./, "");
}

export function hostsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeHostname(a) === normalizeHostname(b);
}

/**
 * Whether middleware should 302 authenticated `/` into the POS shell.
 *
 * - No marketing/app split configured → yes (safe default).
 * - Request is on the marketing host → no (landing stays public).
 * - Request is on the app host (or anything else) → yes.
 */
export function shouldRedirectAuthenticatedHome(args: {
  requestHost: string;
  appOrigin?: string | null;
  marketingOrigin?: string | null;
}): boolean {
  const app = hostnameFromOrigin(args.appOrigin);
  const marketing = hostnameFromOrigin(args.marketingOrigin);
  if (!app || !marketing || hostsMatch(app, marketing)) {
    return true;
  }
  if (hostsMatch(args.requestHost, marketing)) {
    return false;
  }
  return true;
}

/** Resolve app + marketing origins from env (middleware / Node). */
export function resolveHostingOrigins(env: NodeJS.ProcessEnv = process.env): {
  appOrigin: string | null;
  marketingOrigin: string | null;
} {
  const appOrigin =
    env.NEXT_PUBLIC_APP_URL?.trim() ||
    env.NOVEND_APP_URL?.trim() ||
    env.NEXT_PUBLIC_SITE_URL?.trim() ||
    null;
  const marketingOrigin = env.NEXT_PUBLIC_MARKETING_URL?.trim() || null;
  return { appOrigin, marketingOrigin };
}
