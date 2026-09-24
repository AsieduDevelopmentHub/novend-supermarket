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

/**
 * Direct `process.env.NEXT_PUBLIC_*` reads. Next inlines these into the client
 * bundle. Indexing a passed `env` object does not, so server HTML and the
 * hydrated client would disagree (absolute dashboard URL vs `/signup`).
 */
const inlinedAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const inlinedMarketingUrl = process.env.NEXT_PUBLIC_MARKETING_URL;
const inlinedSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

function originsFromValues(
  appUrl: string | undefined,
  marketingUrl: string | undefined,
  siteUrl: string | undefined,
  serverOnlyAppUrl?: string | undefined,
): { appOrigin: string | null; marketingOrigin: string | null } {
  const appOrigin = appUrl?.trim() || serverOnlyAppUrl?.trim() || siteUrl?.trim() || null;
  const marketingOrigin = marketingUrl?.trim() || siteUrl?.trim() || null;
  return { appOrigin, marketingOrigin };
}

/**
 * Resolve app + marketing origins from env (middleware / Node / client bundle).
 *
 * The default path uses only `NEXT_PUBLIC_*` so server and client render the
 * same href. `NOVEND_APP_URL` is server-only and is honored only when a caller
 * passes an explicit env object (tests, scripts).
 */
export function resolveHostingOrigins(env: NodeJS.ProcessEnv = process.env): {
  appOrigin: string | null;
  marketingOrigin: string | null;
} {
  if (env === process.env) {
    return originsFromValues(inlinedAppUrl, inlinedMarketingUrl, inlinedSiteUrl);
  }
  return originsFromValues(
    env.NEXT_PUBLIC_APP_URL,
    env.NEXT_PUBLIC_MARKETING_URL,
    env.NEXT_PUBLIC_SITE_URL,
    env.NOVEND_APP_URL,
  );
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

export function getMarketingOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  return normalizeOrigin(resolveHostingOrigins(env).marketingOrigin);
}

/**
 * Public-site href (home, legal) for the host that is actually serving the page.
 *
 * On the marketing host, or on localhost, keep a relative path so the visitor
 * stays on that site. On the app host, send them to the marketing origin —
 * `dashboard…/` is not the public website. Auth paths (`/login`, `/signup`)
 * belong on the app host — use `appEntryHref` for those, not this helper.
 */
export function publicSiteHref(
  path: string,
  requestHost: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const normalized = !path || path === "/" ? "/" : path.startsWith("/") ? path : `/${path}`;
  if (!isHostSplit(env)) return normalized;
  const marketing = getMarketingOrigin(env);
  const appHost = hostnameFromOrigin(getAppOrigin(env));
  if (!marketing || !requestHost || !hostsMatch(requestHost, appHost)) return normalized;
  return `${marketing}${normalized}`;
}

/**
 * App-host href for marketing CTAs that open POS / auth (Sign in, Start free,
 * Open app). Unsplit deploys keep relative paths.
 */
export function appEntryHref(path: string, env: NodeJS.ProcessEnv = process.env): string {
  const normalized = !path || path === "/" ? "/" : path.startsWith("/") ? path : `/${path}`;
  if (!isHostSplit(env)) return normalized;
  const origin = getAppOrigin(env);
  if (!origin) return normalized;
  return `${origin}${normalized}`;
}
