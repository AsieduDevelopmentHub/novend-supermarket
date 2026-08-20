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

Boot sequence:

1. Main loads local `offline-boot.html` (packaged under `extraResources`).
2. The boot page client-navigates to `/dashboard` on the hosted origin.
3. The registered service worker serves the cached document; Dexie restores the shell.
4. `persist:novend` keeps SW + IndexedDB across launches.
5. After the first successful load of that origin, `userData/terminal-state.json`
   records that this terminal is initialized.

If the hosted origin has never loaded on this device, show:

> Novend POS hasn't been initialized on this device.
> Connect to the internet once to initialize this terminal.

If it has loaded but the cached shell cannot be served, ask the cashier to
reconnect once. Do not show “Can't reach Novend POS” when the local cache can
run — that state is the in-app offline banner.

## Layers

```text
Next.js UI (renderer at novend-pos.vercel.app)
        ↓
window.novendDesktop (preload)
        ↓
Electron main
```

## Packaging

`electron-builder` produces Windows NSIS, macOS DMG/ZIP, and Linux AppImage/deb.
Tag `v*` builds on GitHub Actions. Update discovery uses Convex HTTP, not the
GitHub Releases API. See `docs/development/DESKTOP_UPDATES.md`.
