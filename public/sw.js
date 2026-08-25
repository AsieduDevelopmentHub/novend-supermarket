/* Novend POS — app-shell cache so a hard refresh can survive offline */
const CACHE_NAME = "novend-pos-v6";
const PRECACHE = [
  "/",
  "/login",
  "/dashboard",
  "/sales",
  "/orders",
  "/returns",
  "/inventory",
  "/wholesale",
  "/customers",
  "/products",
  "/reports",
  "/settings",
  "/more",
  "/about",
  "/users",
  "/branches",
  "/analytics",
  "/suppliers",
  "/platform",
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
              /* auth-gated routes may 302 — ignore */
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

function isAppShellRequest(request, url) {
  if (request.mode === "navigate" || request.destination === "document") return true;
  if (request.headers.get("RSC") === "1") return true;
  if (url.searchParams.has("_rsc")) return true;
  return false;
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
  if (!response || !response.ok) return;
  const copy = response.clone();
  void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
}

/**
 * Offline navigation fallback.
 * Prefer an exact cache hit for the requested URL. If missing, serve a known
 * shell HTML document — the browser URL stays as the deep path; client
 * OfflineNavigationProvider + resolveOfflineView honor location.pathname.
 */
async function matchNavigation(request, url) {
  const exact =
    (await caches.match(request)) || (await caches.match(url.pathname));
  if (exact) return exact;

  const shellCandidates = url.pathname.startsWith("/platform")
    ? ["/platform", "/dashboard", "/sales", "/"]
    : ["/dashboard", "/sales", "/platform", "/"];

  for (const shell of shellCandidates) {
    const hit = await caches.match(shell);
    if (hit) return hit;
  }
  return undefined;
}

/** Serve cache immediately when present; refresh in the background. */
async function staleWhileRevalidate(request, url) {
  const cached =
    (await caches.match(request)) ||
    (request.mode === "navigate" || request.destination === "document"
      ? await caches.match(url.pathname)
      : undefined);

  const networkPromise = fetch(request)
    .then((response) => {
      cachePut(request, response);
      if (request.mode === "navigate" || request.destination === "document") {
        cachePut(new Request(url.pathname), response);
      }
      return response;
    })
    .catch(async (error) => {
      if (cached) return cached;
      throw error;
    });

  if (cached) {
    void networkPromise.catch(() => undefined);
    return cached;
  }

  try {
    return await networkPromise;
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

  if (isAppShellRequest(request, url)) {
    event.respondWith(staleWhileRevalidate(request, url));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkPromise = fetch(request)
          .then((response) => {
            cachePut(request, response);
            return response;
          })
          .catch(async () => cached || new Response("", { status: 503, statusText: "Offline" }));
        if (cached) {
          void networkPromise.catch(() => undefined);
          return cached;
        }
        return networkPromise;
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        cachePut(request, response);
        return response;
      });
    }),
  );
});
