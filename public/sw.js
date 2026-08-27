/* Novend POS — app-shell cache so a hard refresh can survive offline */
const CACHE_NAME = "novend-pos-v9";
/**
 * Public documents + icons only. Do not precache /dashboard (and other gated
 * routes): cache.add follows the auth 302 and stores a redirected login
 * document under the dashboard URL. Chrome then paints ERR_FAILED when that
 * entry is used for a navigation (login → dashboard).
 */
const PRECACHE = [
  "/",
  "/login",
  "/download",
  "/privacy",
  "/terms",
  "/docs",
  "/docs/help",
  "/unauthorized",
  "/manifest.webmanifest",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/branding/brandmark.png",
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

function isAppShellRequest(request, url) {
  if (request.mode === "navigate" || request.destination === "document") return true;
  if (request.headers.get("RSC") === "1") return true;
  if (url.searchParams.has("_rsc")) return true;
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

function cachePut(request, response) {
  if (!response || !response.ok || response.type === "opaque") return;
  const copy = unwrapRedirect(response.clone());
  void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
}

/**
 * Offline navigation fallback.
 * Prefer an exact cache hit for the requested URL. If missing, serve a known
 * shell HTML document — the browser URL stays as the deep path; client
 * OfflineNavigationProvider + resolveOfflineView honor location.pathname.
 */
async function matchNavigation(request, url) {
  const exact = (await caches.match(request)) || (await caches.match(url.pathname));
  if (exact) return unwrapRedirect(exact);

  const shellCandidates = url.pathname.startsWith("/platform")
    ? ["/platform", "/dashboard", "/sales", "/"]
    : ["/dashboard", "/sales", "/platform", "/"];

  for (const shell of shellCandidates) {
    const hit = await caches.match(shell);
    if (hit) return unwrapRedirect(hit);
  }
  return undefined;
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
    if (isRsc) {
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

  if (url.pathname.startsWith("/api/") || url.hostname.includes("convex")) return;

  // Browser must follow the authenticated /login → /dashboard 302 itself.
  // If the SW returns that followed response, Chrome paints ERR_FAILED.
  if (isAuthDocument(url)) return;

  // Android WebView + SW navigation intercept is a known net::ERR_FAILED source.
  const ua = request.headers.get("User-Agent") || "";
  if (ua.includes("NovendCapacitor")) return;

  if (isAppShellRequest(request, url)) {
    event.respondWith(networkFirstDocument(request, url));
    return;
  }

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

  // All other GETs (JSON, fonts, etc.) go to the network. Never reject.
});
