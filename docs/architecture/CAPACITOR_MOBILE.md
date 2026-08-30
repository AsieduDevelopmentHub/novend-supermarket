# Capacitor mobile platform

Version: 1.5.8

## Purpose

Ship Novend POS on Android and iOS via **Capacitor** while keeping a single
Next.js codebase. The WebView loads the hosted Next app; Dexie / outbox /
Convex stay unchanged. All native access goes through `@novend/hardware`.

## Hosted origin

Same pattern as Electron: the WebView **client-navigates** to the hosted Next
app (`https://novend-pos.vercel.app`, overridable with `NOVEND_APP_URL`).

Production builds do **not** set Capacitor `server.url`. A remote `loadUrl`
fails offline even when the service worker already cached the document (same
Chromium issue as electron#35112).

```text
apps/mobile (Capacitor)
        │  local www/index.html (offline boot)
        ▼
Client navigation → hosted /dashboard
        │  allowNavigation keeps @novend/hardware plugins
        ▼
Shared Next.js app
        │
        ├── Dexie / outbox / Convex (unchanged)
        └── @novend/hardware → Capacitor adapters
```

HTTP live-reload (`NOVEND_APP_URL=http://…`) still uses `server.url` so the
device can hit a LAN Next server. Offline cold-start testing requires an HTTPS
hosted origin after at least one successful online sync.

## Offline launch

Aligned with Electron (`DESKTOP_PLATFORM.md`):

1. Capacitor loads packaged `www/index.html` (baked `NOVEND_APP_URL` from
   `scripts/write-mobile-boot.mjs`).
2. The boot page CORS-probes `{host}/api/health`. On success it client-navigates
   to `{host}/api/boot?entry=/dashboard` (not `/dashboard` directly). `/api/*`
   is not intercepted by older hosted service workers, so a poisoned worker can
   be unregistered before the shell loads. On failure it stays on the branded
   retry UI. Android `onReceivedError` plus Capacitor `errorPath` (`www/error.html`)
   recover failed hosted loads to `https://localhost/?stay=1` so Chrome’s
   “The webpage at https://… could not be loaded because: net::ERR_FAILED”
   sheet is never left on screen.
3. Capacitor does **not** register the hosted service worker. Android WebView
   treats SW-handled login→dashboard redirects as `net::ERR_FAILED`. Dexie
   restores session, organization, branch, role, and licence snapshot.
4. More, About, billing, and other shell routes render from IndexedDB. Payment
   and first login still need a network.

Do not create a second mobile database. Dexie is shared with Electron and web.

## Shell (Phase 3)

On Capacitor only:

- Desktop sidebar is hidden
- Floating Onyx bottom tabs: Dashboard · Sales · Inventory · Orders · More
- `/more` groups remaining destinations by role (includes About)
- Tab icons/labels sit above Android gesture and 3-button navigation
  (`--novend-system-nav-inset`: `max(env(safe-area-inset-bottom), 3rem)`).
  The bar background fills the system-nav region. Main content uses
  `--novend-tabbar-offset`.

Web and Electron keep the existing sidebar unchanged.

## Native services (Phase 4)

- Bluetooth thermal printing (Settings → Hardware). Checkout honors Automatic /
  Manual / Do not print. Print (one copy) is the primary post-sale action;
  share and PDF are optional. Without a paired BLE printer, Android opens
  `PrintManager` (not WebView `window.print()`, which never leaves “Opening…”).
- Biometrics + secure unlock token (Settings → Security)
- Local notification topic prefs (push delivery can plug in later)
- Soft OTA check via `NEXT_PUBLIC_MOBILE_UPDATE_JSON` (Later / Update now)
- Deep links: `novend://sale/{id}`, `novend://product/{id}`, …
- Offline backup / restore (Documents on device)
- About page: `/about`
- Android package: `com.novend.pos`. The authoritative version is the root/mobile `package.json`; release CI verifies the Android `versionName` before publishing.
  already present — do not publish until QA sign-off

See `docs/architecture/HARDWARE.md` and `docs/architecture/MOBILE_QA.md`.

## Offline

IndexedDB (Dexie) and the sync outbox remain the offline stack. Product images
are stored as blobs (and optionally a Capacitor filesystem path). No SQLite
migration. Backups exclude image blobs by design.

## Location

`apps/mobile/` — Capacitor config, `www/` fallback, Android / iOS projects.

Local Android builds need **JDK 21** (`pnpm mobile:run:android` selects it). Do not run
`cap run android` against JAVA_HOME 17 — Capacitor 7 compiles with `JavaVersion.VERSION_21`.

Android Studio uses its own Gradle JDK (this project previously used `#JAVA_HOME` →
Temurin 17, which produces `invalid source release: 21`). Set it once:

1. Open `apps/mobile/android` (`pnpm mobile:open:android`).
2. **File → Settings** (Ctrl+Alt+S) → **Build, Execution, Deployment → Build Tools → Gradle**.
3. **Gradle JDK** → **Add JDK…** (or **Download JDK…**) →
   `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`.
   Do **not** leave this on `JAVA_HOME` or `temurin-17`.
4. **File → Project Structure** (Ctrl+Alt+Shift+S) → **Project**: SDK and language level **21**.
5. **File → Sync Project with Gradle Files**. If a 17 daemon is still running, use the
   Android Studio terminal: `.\gradlew --stop`, then sync again.

Dismiss **AGP Upgrade Assistant**. Capacitor 7.6 expects Android Gradle Plugin **8.7.2**;
that banner is not the compile error.

On Windows, `pnpm mobile:sync` runs icon generation then `cap sync android` only.
A partial `ios/` tree without a Podfile makes full `cap sync` fail — use
`pnpm --filter @novend/mobile sync:ios` on macOS after `add:ios`.

## App entry & icons

- Local boot always navigates to `{host}/dashboard` (same entry as Electron), not
  the marketing site. Unauthenticated sessions redirect to `/login`.
- Launcher + splash assets are generated from `apps/desktop/build/icon.png` via
  `pnpm mobile:icons` (runs automatically before sync).

## Local development & auth

Capacitor dev loads Next over plain HTTP (`http://192.168.x.x:3000` or
`http://10.0.2.2:3000` on the emulator). Convex Auth session cookies must be
**non-secure** on those hosts or Android/iOS WebViews silently drop them.

Symptom in the Next.js terminal:

```text
Convex Auth: Unexpected missing refreshToken cookie during client refresh
```

Fix checklist:

1. `NOVEND_APP_URL` (Capacitor sync) and Convex `SITE_URL` must be the **same**
   origin — e.g. `http://192.168.1.202:3000`, not `localhost` on a physical device.
2. Novend patches `@convex-dev/auth` so private LAN / emulator hosts are treated
   like localhost for cookie `secure` in `NODE_ENV=development`.
3. Restart `pnpm dev` after `pnpm install` (applies the patch).
4. Force-close the app and sign in again (clears stale WebView cookie state).

Post-login redirect uses Next.js client navigation (not `window.location`) so
Convex Auth's in-flight token refresh does not trigger Android's native
"Confirm navigation" dialog.

```bash
npx convex env set SITE_URL http://192.168.1.202:3000
set NOVEND_APP_URL=http://192.168.1.202:3000
pnpm mobile:sync
```
