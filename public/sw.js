/* Novend POS — app-shell cache so a hard refresh can survive offline */
const CACHE_NAME = "novend-pos-v24";/**
 * Public documents + icons only. Do not precache `/` or `/dashboard`:
 * cache.add follows the auth 302 and stores POS HTML under the marketing URL
 * (splash stuck on https://novend-pos.vercel.app/). Gated routes 302 to login.
 * Authenticated shells are warmed after login (PwaRegister) and migrated on
 * CACHE_NAME bumps so Cap/Electron cold boot keeps working offline.
 */
const PRECACHE = [
  "/login",
  "/download",
  "/pricing",
  "/product",
  "/demo",
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

/** Paths that must survive a CACHE_NAME bump for Cap/Electron offline cold boot. */
const MIGRATE_SHELL_PATHS = [
  "/dashboard",
  "/sales",
  "/platform",
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
  "/customer-display",
  "/login",
  "/signup",
];

function shouldMigrateCacheEntry(url) {
  if (MIGRATE_SHELL_PATHS.includes(url.pathname)) return true;
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/branding/")
  );
}

async function migrateShellCaches(oldCacheNames) {
  const next = await caches.open(CACHE_NAME);
  for (const name of oldCacheNames) {
    const previous = await caches.open(name);
    const requests = await previous.keys();
    for (const request of requests) {
      let parsed;
      try {
        parsed = new URL(request.url);
      } catch {
        continue;
      }
      if (parsed.origin !== self.location.origin) continue;
      if (!shouldMigrateCacheEntry(parsed)) continue;
      const already = await next.match(request);
      if (already) continue;
      const response = await previous.match(request);
      if (response) {
        try {
          await next.put(request, response);
        } catch {
          /* ignore quota / opaque failures */
        }
      }
    }
  }
}

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
    (async () => {
      const keys = await caches.keys();
      const stale = keys.filter((key) => key !== CACHE_NAME);
      // Copy warmed shells + Next static assets before deleting old buckets.
      // Without this, every CACHE_NAME bump wiped /dashboard and Cap/Electron
      // airplane-mode cold start failed until the next online warm.
      if (stale.length > 0) {
        await migrateShellCaches(stale);
      }
      await Promise.all(stale.map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
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

/** Prefer exact match, then ignore ?v= cache-bust query (branding/icons). */
async function matchStaticAsset(request, url) {
  const exact = await caches.match(request);
  if (exact) return exact;
  if (url.search) {
    const byPath = await caches.match(url.pathname);
    if (byPath) return byPath;
  }
  return (
    (await caches.match(request, { ignoreSearch: true })) ||
    (await caches.match(new Request(url.pathname)))
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

function extractNextStaticUrls(html) {
  const found = new Set();
  const pattern = /(?:src|href)=["'](\/_next\/static\/[^"']+)["']/g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    found.add(match[1]);
  }
  return [...found];
}

async function warmDocumentStaticAssets(html) {
  const urls = extractNextStaticUrls(html);
  if (urls.length === 0) return;
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    urls.map(async (pathname) => {
      try {
        const existing = await cache.match(pathname);
        if (existing) return;
        const response = await fetch(pathname, {
          credentials: "same-origin",
          cache: "no-cache",
        });
        if (response.ok) {
          await cache.put(pathname, response);
        }
      } catch {
        /* ignore — shell HTML may still load from older matching chunks */
      }
    }),
  );
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
  const contentType = response.headers.get("content-type") || "";
  const isHtml = contentType.includes("text/html");
  void caches.open(CACHE_NAME).then(async (cache) => {
    await cache.put(request, copy);
    // Keep HTML and its hashed /_next/static chunks in the same cache generation
    // so a mid-deploy offline reopen does not paint a blank shell.
    if (isHtml) {
      try {
        const html = await response.clone().text();
        await warmDocumentStaticAssets(html);
      } catch {
        /* ignore */
      }
    }
  });
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

/** Segment-bounded — never treat authenticated `/products` as marketing `/product`. */
function isMarketingPathname(pathname) {
  const exactOrChild = (base) => pathname === base || pathname.startsWith(`${base}/`);
  return (
    pathname === "/" ||
    exactOrChild("/download") ||
    exactOrChild("/pricing") ||
    exactOrChild("/product") ||
    exactOrChild("/demo") ||
    exactOrChild("/industries") ||
    exactOrChild("/contact") ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/unauthorized" ||
    exactOrChild("/docs")
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

/** Network first for documents so a cached login 302 never paints ERR_FAILED.
 * Cap/Electron often report online while the document fetch never settles —
 * race a short budget so post-login /dashboard cannot strand the Welcome toast
 * on the login skeleton for minutes.
 *
 * If the host 302s to /login (no Convex cookie while the till still has an
 * offline shell), never paint that login document under the app URL — serve
 * the cached shell so CloudReconnectBanner can ask for the password in place.
 */
const NETWORK_DOCUMENT_BUDGET_MS = 2500;

async function networkFirstDocument(request, url) {
  const cachedFallback = () => matchNavigation(request, url);

  try {
    const response = await Promise.race([
      fetchFollowRedirects(request),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("document-network-budget")), NETWORK_DOCUMENT_BUDGET_MS);
      }),
    ]);
    if (response && response.url && isLoginDocumentUrl(response.url) && !isAuthDocument(url)) {
      const fallback = await cachedFallback();
      if (fallback) return fallback;
      throw new Error("auth-redirect-without-shell-cache");
    }
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
    const fallback = await cachedFallback();
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

  // /login and /signup: live network when online so a signed-in session can
  // 302 to /dashboard. Offline sign-out / cold boot (signedOut|fromBoot) must
  // prefer the precached login document immediately — network-first hangs or
  // returns a newer HTML shell whose /_next chunks are not cached yet, which
  // paints “Failed to load chunk” / “You're working offline” instead of login.
  if (isAuthDocument(url)) {
    event.respondWith(
      (async () => {
        const preferCache =
          url.searchParams.get("fromBoot") === "1" ||
          url.searchParams.get("signedOut") === "1";

        async function cachedAuth() {
          return (
            (await caches.match(url.pathname)) ||
            (await caches.match("/login")) ||
            (await caches.match(new Request(url.pathname))) ||
            (await caches.match(request, { ignoreSearch: true }))
          );
        }

        if (preferCache) {
          const cached = await cachedAuth();
          if (cached) {
            void fetch(request)
              .then((response) => {
                if (response && response.ok) cachePut(request, response);
              })
              .catch(() => undefined);
            return unwrapRedirect(cached);
          }
        }

        try {
          const response = await fetch(request);
          if (response && response.ok) cachePut(request, response);
          return response;
        } catch {
          const cached = await cachedAuth();
          if (cached) return unwrapRedirect(cached);
          return new Response(
            "<!doctype html><title>Signed out</title><p>Novend is offline. Reconnect to sign in, or open Novend once while online so this device can cache the login screen.</p>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }
      })(),
    );
    return;
  }

  // Signed-in `/` 302s to /dashboard. If the SW follows and unwraps that,
  // the address bar stays on the marketing URL and paints the POS splash.
  if (url.pathname === "/") return;

  if (isStaticAsset(url)) {
    event.respondWith(
      matchStaticAsset(request, url).then((cached) => {
        const networkPromise = fetchFollowRedirects(request)
          .then((response) => {
            cachePut(request, response);
            // Also store the unversioned pathname so ?v= cache-bust still hits offline.
            if (url.pathname.startsWith("/branding/") || url.pathname.startsWith("/icons/")) {
              cachePut(new Request(url.pathname), response);
            }
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

self.addEventListener("push", (event) => {
  let title = "Novend";
  let body = "You have a new alert.";
  let href = "/dashboard";
  try {
    const raw = event.data ? event.data.text() : "";
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        if (typeof parsed.title === "string" && parsed.title.trim()) title = parsed.title;
        if (typeof parsed.body === "string" && parsed.body.trim()) body = parsed.body;
        if (parsed.data && typeof parsed.data.href === "string" && parsed.data.href.startsWith("/")) {
          href = parsed.data.href;
        }
      }
    }
  } catch {
    /* keep defaults */
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { href },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href =
    event.notification.data && typeof event.notification.data.href === "string"
      ? event.notification.data.href
      : "/dashboard";
  const targetUrl = new URL(href, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          void client.focus();
          if ("navigate" in client) {
            void client.navigate(targetUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
