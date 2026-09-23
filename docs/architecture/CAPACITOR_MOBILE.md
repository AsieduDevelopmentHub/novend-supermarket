# Capacitor mobile platform

Version: 1.6.3

## Purpose

Ship Novend POS on **Android** via **Capacitor** while keeping a single Next.js
codebase. Customer **iOS** is a Safari Home Screen PWA; `apps/mobile/ios` is a
future native tree and is not an App Store client. The Android WebView loads
the hosted Next app; Dexie / outbox / Convex stay unchanged. All native access
goes through `@novend/hardware`.

## Hosted origin

Same pattern as Electron: the WebView **client-navigates** to the hosted Next
app. The origin is baked from `NOVEND_APP_URL`; production builds do not use a
fallback.

### Owned-host policy

The only production hostname currently approved to run inside the native
WebView is:

- `novend-pos.vercel.app` — Novend production deployment

There are currently no approved preview hostnames. Vercel's
`*.vercel.app` wildcard is intentionally forbidden. A preview must receive a
stable, Novend-controlled exact hostname and be added to
`scripts/mobile-origin-policy.mjs` plus this list before it can be used in a
native production build.

Production mobile syncs set `NOVEND_MOBILE_BUILD=production` and fail when
`NOVEND_APP_URL` is missing, malformed, non-HTTPS, localhost/private LAN, uses
a non-standard port, contains a path/query/hash, or names a host outside that
allowlist. `allowNavigation` contains exact hostnames only.

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
device can hit a localhost, Android emulator (`10.0.2.2`), or RFC1918 private
LAN Next server. Public HTTP hosts are rejected, and cleartext/mixed-content
settings are enabled only for this development mode. Offline cold-start
testing requires an HTTPS hosted origin after at least one successful online
sync.

## Offline launch

Aligned with Electron (`DESKTOP_PLATFORM.md`):

1. Capacitor loads packaged `www/index.html` (baked `NOVEND_APP_URL` from
   `scripts/write-mobile-boot.mjs`).
2. The boot page **immediately** client-navigates to `{host}/dashboard?fromBoot=1`.
   It does **not** wait on `/api/health` (Android often reports online on a
   weak or dead radio) and does **not** open `/api/boot` (that path is
   network-only because the worker skips `/api/*`).
3. After one successful online open, `PwaRegister` installs `public/sw.js` on
   the hosted origin. Offline, that worker serves the cached shell
   (cache-first when `fromBoot=1`, otherwise network-first; unwraps redirects;
   never caches login HTML under `/dashboard`; never uses the marketing `/`
   document as a POS shell fallback). Dexie + `novend.offlineSession`
   restore the workspace.
4. If the hosted document cannot load, Android retries once with
   `LOAD_CACHE_ELSE_NETWORK` so a previously opened workspace can come back
   while the worker starts. Only a second failure plus `www/error.html` recover
   to `https://localhost/?stay=1`. First run with no cache still needs one
   online open.
5. More, About, billing, and other shell routes render from IndexedDB. Payment
   and first login still need a network.

Do not create a second mobile database. Dexie is shared with Electron and web.

## Shell (Phase 3)

On Capacitor only:

- Desktop sidebar is hidden
- Floating Onyx bottom tabs: Dashboard · Sales · Inventory · Orders · More
- `/more` groups remaining destinations by role (includes About)
- Tab icons/labels sit above Android gesture and 3-button navigation
  (`--novend-system-nav-inset`: `max(env(safe-area-inset-bottom), 1.75rem)`).
  The bar background fills the system-nav region. Main content uses
  `--novend-tabbar-offset`.

Web and Electron keep the existing sidebar unchanged.

## Native services (Phase 4)

- Bluetooth thermal printing: Settings → Hardware pairs one device-local printer
  (Nearby BLE on Android/iOS, or Android Classic RFCOMM/SPP bonded printers).
  Checkout honors Settings → Receipt template (`automatic` / `manual` / `never`)
  and prints one ESC/POS copy. On failure the sale sheet offers Retry, Hardware
  settings, Share, and Save PDF. Share opens the Android share sheet via
  `window.NovendNative.finishShare`.
- Biometrics + unlock token (Settings → Security)
- Local notification topic prefs (push delivery can plug in later)
- Soft OTA check via `NEXT_PUBLIC_MOBILE_UPDATE_JSON` (Later / Update now)
- Deep links: `novend://sale/{id}`, `novend://order/{id}`,
  `novend://product/{id}`, `novend://dashboard`, and `novend://sales`.
  Unknown custom hosts, foreign HTTP(S) origins, malformed or multi-segment
  entity paths, protocol-relative URLs, fragments, and all query parameters
  are rejected. This prevents redirect parameters from becoming a navigation
  escape.
- Offline backup / restore (Documents on device)
- About page: `/about`. Hosted **App version** is `package.json` via `APP_VERSION`
  (not a second hardcoded string). Native shell version can still differ until the
  APK is installed; About warns when they diverge.
- Android package: `com.novend.pos`. The authoritative version is the root/mobile
  `package.json`; release CI verifies the Android `versionName` before publishing.

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

## Release origin verification

Release automation syncs with `NOVEND_MOBILE_BUILD=production`, then runs:

```bash
pnpm mobile:verify-origin
```

The check reads both the source boot config and the copy baked into Android
assets, prints `Baked mobile application origin: <origin>`, and fails unless
both exactly match the approved production `NOVEND_APP_URL`. The local signed
release builder runs the same check before Gradle.

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

Post-login on Capacitor uses `location.replace` so the auth layout cannot
stack over the dashboard (SoftNav is not mounted on `/login`). Before that
replace, `prepareHardNavigation` marks the login form clean. Android also
auto-confirms `onJsBeforeUnload` so WebView never shows Stay / Leave.

```bash
npx convex env set SITE_URL http://192.168.1.202:3000
set NOVEND_APP_URL=http://192.168.1.202:3000
pnpm mobile:sync
```
