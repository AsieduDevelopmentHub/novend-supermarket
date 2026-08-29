import { NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/auth/safe-return-path";

/**
 * Trampoline for Capacitor (and any client stuck on an old service worker).
 *
 * `public/sw.js` v8 intercepts every same-origin GET except `/api/*`. A poisoned
 * worker therefore never lets `/dashboard` load, so it never updates itself.
 * This path is under `/api/`, so that worker lets the document through. The
 * page unregisters the worker, then replaces to the app shell.
 */
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const url = new URL(request.url);
  const entry = safeInternalPath(url.searchParams.get("entry")) ?? "/dashboard";
  const fromBoot = url.searchParams.get("fromBoot") !== "0";
  const target =
    fromBoot && !entry.includes("fromBoot=")
      ? `${entry}${entry.includes("?") ? "&" : "?"}fromBoot=1`
      : entry;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opening Novend</title>
  <style>
    html,body{margin:0;min-height:100%;background:#0b1f33;color:#e2e8f0;font-family:system-ui,sans-serif}
    main{min-height:100vh;display:grid;place-items:center;padding:2rem;text-align:center}
  </style>
</head>
<body>
  <main><p>Opening Novend…</p></main>
  <script>
    var target = ${JSON.stringify(target)};
    var gone = false;
    function go() {
      if (gone) return;
      gone = true;
      location.replace(target);
    }
    function hasModernCache(keys) {
      return keys.some(function (key) {
        var match = /^novend-pos-v(\d+)$/.exec(key);
        return match && Number(match[1]) >= 9;
      });
    }
    function finish() {
      if (!("serviceWorker" in navigator) || !("caches" in window)) {
        go();
        return;
      }
      caches.keys().then(function (keys) {
        if (hasModernCache(keys)) {
          go();
          return;
        }
        navigator.serviceWorker.getRegistrations()
          .then(function (regs) {
            return Promise.all(regs.map(function (reg) { return reg.unregister(); }));
          })
          .then(go, go);
      }, go);
    }
    finish();
    setTimeout(go, 800);
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'",
    },
  });
}
