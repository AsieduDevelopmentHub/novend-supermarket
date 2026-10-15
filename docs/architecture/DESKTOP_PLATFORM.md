# Desktop platform (Electron) — Millie's Supermarket

Version: 2.0.0

## Purpose

Ship Millie's Supermarket as a native desktop till. The Next.js app is the
renderer, but it is **bundled inside the installer** and served on loopback.
There is no hosted Novend URL and no “connect once to cache” step.

## Local origin (required)

Packaged Electron:

1. Main process starts Next `output: "standalone"` via `ELECTRON_RUN_AS_NODE`
   (`apps/desktop/src/local-server.ts`).
2. Server binds `127.0.0.1` on an ephemeral port.
3. Window loads `http://127.0.0.1:<port>/login`.
4. Session partition: `persist:millies`.

Dev:

1. Run `pnpm dev` (Next fixed on `:3737` — see `constants/dev-server.ts`).
2. Run `pnpm desktop:dev` (`ELECTRON_DEV=1` → `http://127.0.0.1:3737`).

Next does **not** tell Electron if it hopped ports; Millie's pins `:3737` for both.
Optional override: `NOVEND_APP_URL` / `ELECTRON_RENDERER_URL` (rare).

Resolution order (`resolveAppUrl` / `ensure` in main):

1. `NOVEND_APP_URL` if set
2. Dev → `http://127.0.0.1:3737`
3. Packaged → origin from started local standalone server

Never falls back to `dashboard.novendpos.app`.

## Packaging

```bash
pnpm desktop:prepare   # next build + copy standalone → apps/desktop/resources/app-server
pnpm desktop:dist:win  # electron-builder (includes app-server as extraResource)
```

`electron-builder` produces Windows NSIS (and mac/linux targets). Cloud
auto-update feed is optional and usually empty for Millie's.

## Layers

```text
Bundled Next standalone (127.0.0.1)
        ↓
BrowserWindow (renderer)
        ↓
window.novendDesktop (preload)
        ↓
Electron main (IPC) → hardware registry (printers, scanners, …)
```

Hardware configuration lives under Settings → Hardware. See
`docs/architecture/HARDWARE.md`.
