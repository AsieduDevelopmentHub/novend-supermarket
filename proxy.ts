import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";

const isLoginPage = createRouteMatcher(["/login", "/signup"]);
const isPublicRoute = createRouteMatcher(["/login", "/signup", "/api/auth(.*)"]);
const isPlatformRoute = createRouteMatcher(["/platform(.*)"]);
const isAdminOnly = createRouteMatcher(["/branches(.*)"]);
const isAdminOrManager = createRouteMatcher(["/analytics(.*)", "/users(.*)"]);

function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  // Dev bundlers may need eval; production drops unsafe-eval.
  // Styles still allow unsafe-inline (next/font, next-themes). Scripts use nonce + strict-dynamic.
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

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

function withSecurityHeaders(response: NextResponse, nonce: string) {
  const csp = buildCsp(nonce);
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-DNS-Prefetch-Control", "on");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  return response;
}

async function roleForToken(token: string | undefined) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!token || !convexUrl) return null;
  try {
    const client = new ConvexHttpClient(convexUrl);
    client.setAuth(token);
    const me = await client.query(api.users.me, {});
    return me?.role ?? null;
  } catch {
    return null;
  }
}

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);

    const authenticated = await convexAuth.isAuthenticated();

    if (request.nextUrl.pathname.startsWith("/signup")) {
      return withSecurityHeaders(nextjsMiddlewareRedirect(request, "/login"), nonce);
    }

    if (isLoginPage(request) && authenticated) {
      return withSecurityHeaders(nextjsMiddlewareRedirect(request, "/dashboard"), nonce);
    }

    if (!isPublicRoute(request) && !authenticated) {
      return withSecurityHeaders(nextjsMiddlewareRedirect(request, "/login"), nonce);
    }

    if (
      authenticated &&
      !isPlatformRoute(request) &&
      (isAdminOnly(request) || isAdminOrManager(request))
    ) {
      const role = await roleForToken(await convexAuth.getToken());
      if (isAdminOnly(request) && role !== "administrator") {
        return withSecurityHeaders(nextjsMiddlewareRedirect(request, "/dashboard"), nonce);
      }
      if (isAdminOrManager(request) && role !== "administrator" && role !== "manager") {
        return withSecurityHeaders(nextjsMiddlewareRedirect(request, "/dashboard"), nonce);
      }
    }

    return withSecurityHeaders(
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
