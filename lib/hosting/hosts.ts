/**
 * Host split between public marketing and the POS app.
 *
 * Production (novendpos.app):
 *   Marketing: https://www.novendpos.app  (`NEXT_PUBLIC_MARKETING_URL` / `NEXT_PUBLIC_SITE_URL`)
 *   App:       https://dashboard.novendpos.app (`NEXT_PUBLIC_APP_URL` / `NOVEND_APP_URL`)
 *   Apex `novendpos.app` redirects to www at the DNS/edge layer.
 *
 * Unsplit / single-origin deployments leave marketing URL unset (or equal to the
 * app URL). In that case authenticated `/` still redirects into the app — today's
 * Cap / Electron / localhost behavior.
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

export function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const raw = value.trim().replace(/\/+$/, "");
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProtocol).origin;
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

/** Resolve app + marketing origins from env (middleware / Node / client bundle). */
export function resolveHostingOrigins(env: NodeJS.ProcessEnv = process.env): {
  appOrigin: string | null;
  marketingOrigin: string | null;
} {
  const appOrigin =
    env.NEXT_PUBLIC_APP_URL?.trim() ||
    env.NOVEND_APP_URL?.trim() ||
    env.NEXT_PUBLIC_SITE_URL?.trim() ||
    null;
  const marketingOrigin =
    env.NEXT_PUBLIC_MARKETING_URL?.trim() || env.NEXT_PUBLIC_SITE_URL?.trim() || null;
  return { appOrigin, marketingOrigin };
}

/** True when marketing and app are configured as different hosts. */
export function isHostSplit(env: NodeJS.ProcessEnv = process.env): boolean {
  const { appOrigin, marketingOrigin } = resolveHostingOrigins(env);
  const app = normalizeOrigin(appOrigin);
  const marketing = normalizeOrigin(marketingOrigin);
  if (!app || !marketing) return false;
  return !hostsMatch(hostnameFromOrigin(app), hostnameFromOrigin(marketing));
}

export function getAppOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  return normalizeOrigin(resolveHostingOrigins(env).appOrigin);
}

/**
 * Auth / POS entry href for marketing CTAs (Sign in, Start free, Open app).
 * When hosts are split, returns an absolute URL on the app origin so www never
 * serves `/login` as the destination. Unsplit deploys keep relative paths.
 */
export function appEntryHref(path: string, env: NodeJS.ProcessEnv = process.env): string {
  const normalized = !path || path === "/" ? "/" : path.startsWith("/") ? path : `/${path}`;
  if (!isHostSplit(env)) return normalized;
  const origin = getAppOrigin(env);
  if (!origin) return normalized;
  return `${origin}${normalized}`;
}
