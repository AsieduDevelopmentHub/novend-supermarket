# Desktop platform (Electron)

Version: 1.0.0

## Purpose

Ship Novend POS as a native desktop app while the Next.js web app remains the
renderer. Convex is still the source of truth. Dexie is the local operational
cache.

## Hosted origin

Packaged Electron **must** load the production web app:

**https://novend-pos.vercel.app**

`NOVEND_APP_URL` is a **build-time** override baked into
`apps/desktop/build/update-config.json` (`appUrl`). GitHub Actions env vars are
not present on cashiers’ machines. A runtime fallback of a made-up domain will
fail DNS and show a connect-once screen forever.

Resolution order:

1. `NOVEND_APP_URL` (dev / explicit launch)
2. Packaged `update-config.json` `appUrl`
3. `https://novend-pos.vercel.app`

## Offline launch

Electron must not call `loadURL(https://…)` first when the machine is offline —
Chromium fails that call even when the service worker already cached the app
(electron#35112).

Boot sequence (aligned with Princellen):

1. Main loads local `offline-boot.html` (packaged under `extraResources`).
2. The boot page client-navigates to `/dashboard` on the hosted origin.
3. The registered service worker serves the cached document; Dexie restores the shell.
4. `persist:novend` keeps SW + IndexedDB + auth cookies across launches.

If the shell is not yet cached, recovery asks the cashier to connect once so the
terminal can cache Novend POS. After that, offline launch uses Cache Storage —
no separate “initialized” flag file.

Background sync (while online) runs on a timer and when the outbox pending count
crosses a threshold — see `lib/offline/freshness.ts`.

## Web marketing vs desktop

The hosted web app serves a public SaaS landing at `/`. Electron must **not**
open that route:

1. Offline boot always navigates to `/dashboard`.
2. The landing page client-redirects to `/dashboard` when `novendDesktop` is present.

Marketing UI lives in `features/marketing/` and must stay out of the desktop
offline-first login path.


## Layers

```text
Next.js UI (renderer at novend-pos.vercel.app)
        ↓
window.novendDesktop (preload)
        ↓
Electron main (IPC) → hardware registry (printers, scanners, …)
```

Hardware configuration lives under Settings → Hardware. See
`docs/architecture/HARDWARE.md`.

## Packaging

`electron-builder` produces Windows NSIS, macOS DMG/ZIP, and Linux AppImage/deb.
Tag `v*` builds on GitHub Actions. Update discovery uses Convex HTTP, not the
GitHub Releases API. See `docs/development/DESKTOP_UPDATES.md`.
