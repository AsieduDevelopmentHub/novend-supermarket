# Capacitor mobile platform

Version: 1.4.0

## Purpose

Ship Novend POS on Android and iOS via **Capacitor** while keeping a single
Next.js codebase. The WebView loads the hosted Next app; Dexie / outbox /
Convex stay unchanged. All native access goes through `@novend/hardware`.

## Hosted origin

Same pattern as Electron: the WebView loads the hosted Next app
(`https://novend-pos.vercel.app`, overridable with `NOVEND_APP_URL`).

```text
apps/mobile (Capacitor)
        │  server.url
        ▼
Shared Next.js app
        │
        ├── Dexie / outbox / Convex (unchanged)
        └── @novend/hardware → Capacitor adapters
```

## Shell (Phase 3)

On Capacitor only:

- Desktop sidebar is hidden
- Floating Onyx bottom tabs: Dashboard · Sales · Inventory · Orders · More
- `/more` groups remaining destinations by role (includes About)
- Main content pads above the tab bar + safe area

Web and Electron keep the existing sidebar unchanged.

## Native services (Phase 4)

- Bluetooth thermal printing (Settings → Hardware)
- Biometrics + secure unlock token (Settings → Security)
- Local notification topic prefs (push delivery can plug in later)
- Soft OTA check via `NEXT_PUBLIC_MOBILE_UPDATE_JSON` (Later / Update now)
- Deep links: `novend://sale/{id}`, `novend://product/{id}`, …
- Offline backup / restore (Documents on device)
- About page: `/about`
- Android store prep: package `com.novend.pos`, versionName `0.4.0`, icons/splash
  already present — do not publish until QA sign-off

See `docs/architecture/HARDWARE.md` and `docs/architecture/MOBILE_QA.md`.

## Offline

IndexedDB (Dexie) and the sync outbox remain the offline stack. Product images
are stored as blobs (and optionally a Capacitor filesystem path). No SQLite
migration. Backups exclude image blobs by design.

## Location

`apps/mobile/` — Capacitor config, `www/` fallback, Android / iOS projects.

On Windows, `pnpm mobile:sync` runs icon generation then `cap sync android` only.
A partial `ios/` tree without a Podfile makes full `cap sync` fail — use
`pnpm --filter @novend/mobile sync:ios` on macOS after `add:ios`.

## App entry & icons

- Capacitor `server.url` loads `{host}/dashboard` (same entry as Electron), not the
  marketing site. Unauthenticated sessions redirect to `/login`.
- Launcher + splash assets are generated from `apps/desktop/build/icon.png` via
  `pnpm mobile:icons` (runs automatically before sync).
