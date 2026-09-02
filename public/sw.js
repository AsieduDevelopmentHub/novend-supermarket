/* Novend POS — app-shell cache so a hard refresh can survive offline */
const CACHE_NAME = "novend-pos-v14";
/**
 * Public documents + icons only. Do not precache `/` or `/dashboard`:
 * cache.add follows the auth 302 and stores POS HTML under the marketing URL
 * (splash stuck on https://novend-pos.vercel.app/). Gated routes 302 to login.
 */
const PRECACHE = [
  "/login",
  "/download",
  "/privacy",
  "/terms",
  "/docs",
  "/docs/help",
  "/docs/releases",
  "/unauthorized",
  "/manifest.webmanifest",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/branding/brandmark.png",
  "/branding/logo_horizontal.png",
  "/branding/logo_horizontal_light.png",
  "/branding/logo_vertical.png",
  "/branding/login_hero.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          PRECACHE.map((url) =>
            cache.add(url).catch(() => {
              /* ignore missing public assets */
            }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Chrome refuses a redirected Response for a navigation (redirect mode is
 * "manual" on navigate requests). Symptom: brief "This site can't be reached"
 * / net::ERR_FAILED on login → dashboard, then the real page loads — or the
 * WebView stays on the error sheet.
 */
function unwrapRedirect(response) {
  if (!response) {
    return new Response("Novend POS is offline. Reconnect and try again.", {
      status: 503,
      statusText: "Offline",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (response.type === "opaqueredirect") {
    return new Response("Novend POS could not complete a redirect.", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (!response.redirected) return response;
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function fetchFollowRedirects(request) {
  return fetch(request.url, {
    method: "GET",
    headers: request.headers,
    credentials: request.credentials === "omit" ? "omit" : "same-origin",
    redirect: "follow",
    cache: "no-cache",
  }).then(unwrapRedirect);
}

const SHELL_PATHS = [
  "/",
  "/dashboard",
  "/sales",
  "/customer-display",
  "/orders",
  "/returns",
  "/inventory",
  "/wholesale",
  "/customers",
  "/products",
  "/reports",
  "/analytics",
  "/settings",
  "/more",
  "/about",
  "/users",
  "/branches",
  "/suppliers",
  "/platform",
];

function isAppShellRequest(request, url) {
  if (request.mode === "navigate" || request.destination === "document") return true;
  if (request.headers.get("RSC") === "1") return true;
  if (url.searchParams.has("_rsc")) return true;
  if (SHELL_PATHS.includes(url.pathname)) return true;
  return false;
}

function isAuthDocument(url) {
  return url.pathname === "/login" || url.pathname === "/signup";
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/branding/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".woff2")
  );
}

function isLoginDocumentUrl(urlString) {
  try {
    const parsed = new URL(urlString, self.location.origin);
    return parsed.pathname === "/login" || parsed.pathname === "/signup";
  } catch {
    return false;
  }
}

function cachePut(request, response) {
  if (!response || !response.ok || response.type === "opaque") return;
  // Never store a followed login 302 under /dashboard (ERR_FAILED on Cap).
  if (response.url && isLoginDocumentUrl(response.url)) return;
  if (response.url) {
    try {
      const requested = new URL(
        typeof request === "string" ? request : request.url,
        self.location.origin,
      );
      const finalUrl = new URL(response.url, self.location.origin);
      // Followed `/` → `/dashboard` must not occupy the marketing cache key.
      if (finalUrl.pathname !== requested.pathname) return;
    } catch {
      /* ignore */
    }
  }
  const copy = unwrapRedirect(response.clone());
  void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
}

/**
 * Offline navigation fallback.
/**
 * Prefer an exact cache hit for the requested URL. If missing, serve a known
 * *workspace* shell — never marketing HTML (`/`, /docs, /privacy). Cold-start
 * `fromBoot=1` used to paint the public landing page as the POS because `/`
 * is precached and `/dashboard` is not.
 * The browser URL stays as the deep path; OfflineNavigationProvider honors it.
 */
const APP_SHELL_FALLBACKS = ["/dashboard", "/sales", "/platform"];

function isMarketingPathname(pathname) {
  return (
    pathname === "/" ||
    pathname === "/download" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/unauthorized" ||
    pathname.startsWith("/docs")
  );
}

async function matchNavigation(request, url) {
  if (isMarketingPathname(url.pathname)) {
    const exact = (await caches.match(request)) || (await caches.match(url.pathname));
    return exact ? unwrapRedirect(exact) : undefined;
  }

  const exact = (await caches.match(request)) || (await caches.match(url.pathname));
  if (exact && !isMarketingPathname(new URL(exact.url || url.href, url.origin).pathname)) {
    return unwrapRedirect(exact);
  }

  const shellCandidates = url.pathname.startsWith("/platform")
    ? ["/platform", ...APP_SHELL_FALLBACKS.filter((path) => path !== "/platform")]
    : APP_SHELL_FALLBACKS;

  for (const shell of shellCandidates) {
    const hit = await caches.match(shell);
    if (hit) return unwrapRedirect(hit);
  }
  return undefined;
}

function isColdBootNavigation(url) {
  return url.searchParams.get("fromBoot") === "1";
}

/**
 * Cap/Electron cold start: prefer the cached shell immediately so the WebView
 * does not wait on a dead radio (which triggers Android onReceivedError).
 */
async function cacheFirstDocument(request, url) {
  const cached = await matchNavigation(request, url);
  if (cached) {
    void fetchFollowRedirects(request)
      .then((response) => {
        cachePut(request, response);
        if (request.mode === "navigate" || request.destination === "document") {
          cachePut(new Request(url.pathname), response);
        }
      })
      .catch(() => undefined);
    return cached;
  }
  return networkFirstDocument(request, url);
}

/** Network first for documents so a cached login 302 never paints ERR_FAILED. */
async function networkFirstDocument(request, url) {
  try {
    const response = await fetchFollowRedirects(request);
    cachePut(request, response);
    if (request.mode === "navigate" || request.destination === "document") {
      cachePut(new Request(url.pathname), response);
    }
    return response;
  } catch {
    const isRsc = request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
    const publicLegal =
      url.pathname === "/privacy" ||
      url.pathname === "/terms" ||
      url.pathname === "/docs" ||
      url.pathname === "/docs/help" ||
      url.pathname === "/docs/releases";
    if (isRsc && !publicLegal) {
      return new Response("Offline", {
        status: 503,
        statusText: "Offline",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    const fallback = await matchNavigation(request, url);
    if (fallback) return fallback;
    return new Response(
      "<!doctype html><title>Offline</title><p>Novend POS is offline. Open a page you visited while online, or reconnect.</p>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // /api/boot is the only API document older Capacitor APKs navigate to.
  // Cache it so airplane-mode cold start can leave the local boot page.
  if (url.hostname.includes("convex")) return;
  if (url.pathname.startsWith("/api/") && url.pathname !== "/api/boot") return;

  // Browser must follow the authenticated /login → /dashboard 302 itself.
  if (isAuthDocument(url)) return;

  // Signed-in `/` 302s to /dashboard. If the SW follows and unwraps that,
  // the address bar stays on the marketing URL and paints the POS splash.
  if (url.pathname === "/") return;

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkPromise = fetchFollowRedirects(request)
          .then((response) => {
            cachePut(request, response);
            return response;
          })
          .catch(async () => cached || new Response("", { status: 503, statusText: "Offline" }));
        if (cached) {
          void networkPromise.catch(() => undefined);
          return unwrapRedirect(cached);
        }
        return networkPromise;
      }),
    );
    return;
  }

  if (isAppShellRequest(request, url)) {
    event.respondWith(
      isColdBootNavigation(url)
        ? cacheFirstDocument(request, url)
        : networkFirstDocument(request, url),
    );
    return;
  }

  // All other GETs (JSON, fonts, etc.) go to the network. Never reject.
});
