import { convexAuthNextjsMiddleware, createRouteMatcher } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { loginPathWithNext, resolvePostAuthPath } from "@/lib/auth/safe-return-path";
import {
  hostnameFromOrigin,
  hostsMatch,
  normalizeOrigin,
  resolveHostingOrigins,
  shouldRedirectAuthenticatedHome,
} from "@/lib/hosting/hosts";
import { isLegalPath } from "@/lib/marketing-routes";
import { applySecurityHeaders } from "@/lib/security/response-headers";

/**
 * Must match `LOCAL_ONLY_CLOUD_COOKIE` in lib/auth/awaiting-cloud-reconnect.ts.
 * Duplicated here so the Edge proxy never imports browser/session helpers.
 */
const LOCAL_ONLY_CLOUD_COOKIE = "novend_local_only";

const isLoginPage = createRouteMatcher([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);
const isPublicRoute = createRouteMatcher([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/billing/callback",
  "/api/auth(.*)",
  "/docs(.*)",
  "/download",
  // Marketing product/pricing (segment-bounded — never a bare product(.*), which matches /products).
  "/pricing",
  "/pricing/(.*)",
  "/product",
  "/product/(.*)",
  "/industries",
  "/industries/(.*)",
  "/contact",
  "/contact/(.*)",
  "/demo",
  "/demo/(.*)",
  "/privacy",
  "/terms",
  "/refund",
  "/cookies",
  "/aup",
  "/dpa",
  "/api/health",
  "/api/boot",
  "/api/mobile-updates/latest",
]);
const isPlatformRoute = createRouteMatcher(["/platform(.*)"]);
const isAdminOnly = createRouteMatcher(["/branches(.*)"]);
const isAdminOrManager = createRouteMatcher(["/analytics(.*)", "/users(.*)"]);

/**
 * Public marketing / docs / legal / health — no session lookup.
 * Excludes `/` (authenticated home redirect) and login pages (post-auth redirect).
 */
const isStaticPublicRoute = createRouteMatcher([
  "/billing/callback",
  "/api/auth(.*)",
  "/docs(.*)",
  "/download",
  "/pricing",
  "/pricing/(.*)",
  "/product",
  "/product/(.*)",
  "/industries",
  "/industries/(.*)",
  "/contact",
  "/contact/(.*)",
  "/demo",
  "/demo/(.*)",
  "/privacy",
  "/terms",
  "/refund",
  "/cookies",
  "/aup",
  "/dpa",
  "/api/health",
  "/api/mobile-updates/latest",
]);

/**
 * Prefer NextResponse.redirect over nextjsMiddlewareRedirect when the target
 * includes a query string. The Convex helper treats the whole href as a
 * pathname (encoding `?` → `%3F`) and re-appends the original search
 * (`fromBoot=1`), which breaks Cap/WebView cold start with net::ERR_FAILED.
 */
function redirectTo(request: NextRequest, href: string) {
  return NextResponse.redirect(new URL(href, request.nextUrl.origin));
}

/**
 * Continue locally clears the Convex JWT but must keep the SPA shell.
 * sessionStorage is invisible to middleware — a same-site cookie carries the latch.
 */
function hasLocalOnlyShellCookie(request: NextRequest): boolean {
  const raw = request.cookies.get(LOCAL_ONLY_CLOUD_COOKIE)?.value?.trim() ?? "";
  if (!raw || raw.length > 200) return false;
  try {
    return decodeURIComponent(raw).length > 0;
  } catch {
    return false;
  }
}

/** When this request is on the app host, send the same path to the marketing origin. */
function redirectToMarketing(request: NextRequest) {
  const { appOrigin, marketingOrigin } = resolveHostingOrigins();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || request.nextUrl.host;
  const onAppHost =
    hostsMatch(requestHost, hostnameFromOrigin(appOrigin)) &&
    !hostsMatch(hostnameFromOrigin(appOrigin), hostnameFromOrigin(marketingOrigin));
  if (!onAppHost) return null;
  const marketing = normalizeOrigin(marketingOrigin);
  if (!marketing) return null;
  const destination = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, marketing);
  return withStaticSecurityHeaders(NextResponse.redirect(destination));
}

/** When this request is on the marketing host, send auth paths to the app origin. */
function redirectAuthToApp(request: NextRequest) {
  const { appOrigin, marketingOrigin } = resolveHostingOrigins();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || request.nextUrl.host;
  const onMarketingHost =
    hostsMatch(requestHost, hostnameFromOrigin(marketingOrigin)) &&
    !hostsMatch(hostnameFromOrigin(appOrigin), hostnameFromOrigin(marketingOrigin));
  if (!onMarketingHost) return null;
  const app = normalizeOrigin(appOrigin);
  if (!app) return null;
  const destination = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, app);
  return withStaticSecurityHeaders(NextResponse.redirect(destination));
}

function cspDirectives(scriptSrc: string) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    // Receipt printing loads HTML via blob:/srcdoc iframes.
    "frame-src 'self' blob:",
    "child-src 'self' blob:",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.convex.cloud",
    "font-src 'self' data:",
    "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site",
    "worker-src 'self' blob:",
  ].join("; ");
}

/** Per-request nonce CSP for app/auth (Next.js stamps scripts; ThemeBootScript matches). */
function buildNonceCsp(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  // Dev bundlers may need eval; production drops unsafe-eval.
  // Styles still allow unsafe-inline (next/font, next-themes). Scripts use nonce + strict-dynamic.
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  return cspDirectives(scriptSrc);
}

/**
 * Static CSP for public marketing — no per-request nonce (pages stay cacheable).
 * `'unsafe-inline'` covers next-themes boot without forcing dynamic rendering.
 */
function buildStaticMarketingCsp() {
  const isDev = process.env.NODE_ENV === "development";
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval'`
    : `script-src 'self' 'unsafe-inline'`;
  return cspDirectives(scriptSrc);
}

function withNonceSecurityHeaders(response: NextResponse, nonce: string) {
  response.headers.set("Content-Security-Policy", buildNonceCsp(nonce));
  applySecurityHeaders(response);
  return response;
}

function withStaticSecurityHeaders(response: NextResponse) {
  response.headers.set("Content-Security-Policy", buildStaticMarketingCsp());
  applySecurityHeaders(response);
  return response;
}

async function sessionForToken(token: string | undefined) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!token || !convexUrl) return null;
  try {
    const client = new ConvexHttpClient(convexUrl);
    client.setAuth(token);
    const me = await client.query(api.users.me, {});
    if (!me) return null;
    return {
      role: me.role ?? null,
      isPlatformAdmin: Boolean(me.isPlatformAdmin),
      needsOnboarding: Boolean(me.needsOnboarding || me.needsProfile),
    };
  } catch {
    return null;
  }
}

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    // Let /api/boot set its own CSP (inline trampoline). Auth middleware still
    // runs; the route is public so unauthenticated Cap cold-start can land.
    if (request.nextUrl.pathname === "/api/boot") {
      return NextResponse.next();
    }

    // Legal pages belong on the marketing host. A visit on the app host
    // (including a new tab from signup) goes to www, not dashboard.
    if (isLegalPath(request.nextUrl.pathname)) {
      const marketingRedirect = redirectToMarketing(request);
      if (marketingRedirect) return marketingRedirect;
    }

    // Auth pages belong on the app host. A visit on www goes to dashboard.
    if (isLoginPage(request)) {
      const appRedirect = redirectAuthToApp(request);
      if (appRedirect) return appRedirect;
    }

    // Marketing / docs / legal / health: security headers only — skip session work.
    if (isStaticPublicRoute(request)) {
      return withStaticSecurityHeaders(NextResponse.next());
    }

    const pathname = request.nextUrl.pathname;
    const isHome = pathname === "/";
    const onLoginPage = isLoginPage(request);

    // Public landing: only authenticate when we might redirect into the POS shell.
    // Otherwise use static marketing CSP (no per-request nonce).
    if (isHome) {
      const { appOrigin, marketingOrigin } = resolveHostingOrigins();
      const authenticated = await convexAuth.isAuthenticated();
      const fromBoot = request.nextUrl.searchParams.get("fromBoot") === "1";
      const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
      const requestHost = forwardedHost || request.nextUrl.host;
      const onAppHost =
        hostsMatch(requestHost, hostnameFromOrigin(appOrigin)) &&
        !hostsMatch(hostnameFromOrigin(appOrigin), hostnameFromOrigin(marketingOrigin));
      if (!authenticated && onAppHost && !fromBoot) {
        const marketing = normalizeOrigin(marketingOrigin);
        if (marketing) {
          return withStaticSecurityHeaders(NextResponse.redirect(new URL("/", marketing)));
        }
      }
      if (authenticated) {
        const redirectHome = shouldRedirectAuthenticatedHome({
          requestHost,
          appOrigin,
          marketingOrigin,
        });
        if (redirectHome) {
          const session = await sessionForToken(await convexAuth.getToken());
          const destination = resolvePostAuthPath(session);
          const fromBoot = request.nextUrl.searchParams.get("fromBoot") === "1";
          const href =
            fromBoot && !destination.includes("fromBoot=")
              ? `${destination}${destination.includes("?") ? "&" : "?"}fromBoot=1`
              : destination;
          return withStaticSecurityHeaders(redirectTo(request, href));
        }
      }
      return withStaticSecurityHeaders(NextResponse.next());
    }

    // App / auth routes: nonce CSP + session checks.
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    // Next.js reads CSP from the *request* to stamp nonce on its scripts.
    requestHeaders.set("Content-Security-Policy", buildNonceCsp(nonce));

    const authenticated = await convexAuth.isAuthenticated();

    // Signed-out navigation must be able to paint /login even if the auth
    // cookie has not been cleared yet (Cap/WebView session race).
    if (onLoginPage && request.nextUrl.searchParams.get("signedOut") === "1") {
      return withNonceSecurityHeaders(
        NextResponse.next({ request: { headers: requestHeaders } }),
        nonce,
      );
    }

    if (onLoginPage && authenticated) {
      const session = await sessionForToken(await convexAuth.getToken());
      const next = request.nextUrl.searchParams.get("next");
      const destination = resolvePostAuthPath(session, next);
      const fromBoot = request.nextUrl.searchParams.get("fromBoot") === "1";
      const href =
        fromBoot && !destination.includes("fromBoot=")
          ? `${destination}${destination.includes("?") ? "&" : "?"}fromBoot=1`
          : destination;
      // 302 to /dashboard. public/sw.js must not intercept /login — returning
      // this followed redirect as a navigation response paints Chrome ERR_FAILED.
      return withNonceSecurityHeaders(redirectTo(request, href), nonce);
    }

    if (!isPublicRoute(request) && !authenticated) {
      // Password-modal "Continue locally" signs out the stale cloud session but
      // keeps the Dexie shell. Allow the app document through (not /platform).
      if (hasLocalOnlyShellCookie(request) && !isPlatformRoute(request)) {
        return withNonceSecurityHeaders(
          NextResponse.next({ request: { headers: requestHeaders } }),
          nonce,
        );
      }
      const loginHref = loginPathWithNext(request.nextUrl.pathname, request.nextUrl.search);
      return withNonceSecurityHeaders(redirectTo(request, loginHref), nonce);
    }

    if (
      authenticated &&
      !isPlatformRoute(request) &&
      (isAdminOnly(request) || isAdminOrManager(request))
    ) {
      const session = await sessionForToken(await convexAuth.getToken());
      // Privileged route resolution fails closed. Backend checks remain
      // authoritative, but an outage must not render an operational shell.
      if (session === null) {
        return withNonceSecurityHeaders(redirectTo(request, "/dashboard"), nonce);
      }
      if (isAdminOnly(request) && session.role !== "administrator") {
        return withNonceSecurityHeaders(redirectTo(request, "/unauthorized"), nonce);
      }
      if (
        isAdminOrManager(request) &&
        session.role !== "administrator" &&
        session.role !== "manager"
      ) {
        return withNonceSecurityHeaders(redirectTo(request, "/unauthorized"), nonce);
      }
    }

    return withNonceSecurityHeaders(
      NextResponse.next({
        request: { headers: requestHeaders },
      }),
      nonce,
    );
  },
  {
    // Persist session cookies so middleware can validate auth on each request.
    cookieConfig: { maxAge: 60 * 60 * 24 * 30 },
  },
);

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
