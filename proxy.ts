import { convexAuthNextjsMiddleware, createRouteMatcher } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { FULLY_OFFLINE } from "@/constants/runtime";
import { loginPathWithNext, resolvePostAuthPath } from "@/lib/auth/safe-return-path";
import {
  hostnameFromOrigin,
  hostsMatch,
  normalizeOrigin,
  resolveHostingOrigins,
} from "@/lib/hosting/hosts";
import { applySecurityHeaders } from "@/lib/security/response-headers";

/**
 * Must match `LOCAL_ONLY_CLOUD_COOKIE` in lib/auth/awaiting-cloud-reconnect.ts.
 * Duplicated here so the Edge proxy never imports browser/session helpers.
 */
const LOCAL_ONLY_CLOUD_COOKIE = "novend_local_only";
/** Must match `MILLIES_LOCAL_SESSION_COOKIE` in lib/offline/millies-auth.ts. */
const MILLIES_LOCAL_SESSION_COOKIE = "millies_local_session";

const isLoginPage = createRouteMatcher([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);
const isPublicRoute = createRouteMatcher([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/billing/callback",
  "/api/auth(.*)",
  "/api/health",
  "/api/boot",
  "/api/mobile-updates/latest",
  // Second-screen cart mirror — localStorage only; no staff session required.
  "/customer-display",
]);
const isPlatformRoute = createRouteMatcher(["/platform(.*)"]);
const isAdminOnly = createRouteMatcher(["/branches(.*)"]);
const isAdminOrManager = createRouteMatcher(["/analytics(.*)", "/users(.*)"]);
const isRetiredPublicPath = createRouteMatcher([
  "/",
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
  "/wholesale(.*)",
  "/branches(.*)",
]);

const isStaticPublicRoute = createRouteMatcher([
  "/billing/callback",
  "/api/auth(.*)",
  "/api/health",
  "/api/mobile-updates/latest",
]);

function redirectTo(request: NextRequest, href: string) {
  return NextResponse.redirect(new URL(href, request.nextUrl.origin));
}

function hasLocalOnlyShellCookie(request: NextRequest): boolean {
  const raw = request.cookies.get(LOCAL_ONLY_CLOUD_COOKIE)?.value?.trim() ?? "";
  if (!raw || raw.length > 200) return false;
  try {
    return decodeURIComponent(raw).length > 0;
  } catch {
    return false;
  }
}

function hasMilliesLocalSessionCookie(request: NextRequest): boolean {
  const raw = request.cookies.get(MILLIES_LOCAL_SESSION_COOKIE)?.value?.trim() ?? "";
  return raw === "1";
}

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

function cspDirectives(scriptSrc: string, extraConnect: string[] = [], extraImg: string[] = []) {
  const connectSrc = [
    "'self'",
    "https://*.convex.cloud",
    "wss://*.convex.cloud",
    "https://*.convex.site",
    "https://*.ingest.sentry.io",
    "https://*.ingest.us.sentry.io",
    "https://www.google-analytics.com",
    "https://analytics.google.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://*.googletagmanager.com",
    ...extraConnect,
  ].join(" ");
  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    "https://*.convex.cloud",
    "https://www.google-analytics.com",
    "https://www.googletagmanager.com",
    ...extraImg,
  ].join(" ");
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-src 'self' blob:",
    "child-src 'self' blob:",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
  ].join("; ");
}

function buildNonceCsp(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  return cspDirectives(scriptSrc);
}

function buildStaticMarketingCsp() {
  const isDev = process.env.NODE_ENV === "development";
  const gaHosts =
    "https://www.googletagmanager.com https://www.google-analytics.com";
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${gaHosts}`
    : `script-src 'self' 'unsafe-inline' ${gaHosts}`;
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

/** Millie's fully offline — no Convex JWT. Client gates setup/login; cookie unlocks shell. */
async function milliesProxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/boot") {
    return NextResponse.next();
  }

  if (isRetiredPublicPath(request)) {
    if (hasMilliesLocalSessionCookie(request)) {
      return withStaticSecurityHeaders(redirectTo(request, "/sales"));
    }
    return withStaticSecurityHeaders(redirectTo(request, "/login"));
  }

  if (isLoginPage(request)) {
    const appRedirect = redirectAuthToApp(request);
    if (appRedirect) return appRedirect;
  }

  if (isStaticPublicRoute(request)) {
    return withStaticSecurityHeaders(NextResponse.next());
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", buildNonceCsp(nonce));

  if (isLoginPage(request)) {
    return withNonceSecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      nonce,
    );
  }

  if (!isPublicRoute(request) && !hasMilliesLocalSessionCookie(request)) {
    const loginHref = loginPathWithNext(request.nextUrl.pathname, request.nextUrl.search);
    return withNonceSecurityHeaders(redirectTo(request, loginHref), nonce);
  }

  return withNonceSecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    nonce,
  );
}

const cloudProxy = convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    if (request.nextUrl.pathname === "/api/boot") {
      return NextResponse.next();
    }

    if (isRetiredPublicPath(request)) {
      const authenticated = await convexAuth.isAuthenticated();
      if (authenticated) {
        return withStaticSecurityHeaders(redirectTo(request, "/dashboard"));
      }
      return withStaticSecurityHeaders(redirectTo(request, "/login"));
    }

    if (isLoginPage(request)) {
      const appRedirect = redirectAuthToApp(request);
      if (appRedirect) return appRedirect;
    }

    if (isStaticPublicRoute(request)) {
      return withStaticSecurityHeaders(NextResponse.next());
    }

    const onLoginPage = isLoginPage(request);
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", buildNonceCsp(nonce));

    const authenticated = await convexAuth.isAuthenticated();

    if (
      onLoginPage &&
      (request.nextUrl.searchParams.get("signedOut") === "1" ||
        request.nextUrl.searchParams.get("shellBack") === "1")
    ) {
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
      return withNonceSecurityHeaders(redirectTo(request, href), nonce);
    }

    if (!isPublicRoute(request) && !authenticated) {
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
    cookieConfig: { maxAge: 60 * 60 * 24 * 30 },
  },
);

export default FULLY_OFFLINE ? milliesProxy : cloudProxy;

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
