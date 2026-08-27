# Changelog

All notable changes to Novend POS are recorded here. The project follows [Semantic Versioning](https://semver.org/); each `vX.Y.Z` tag builds desktop installers and publishes a GitHub Release titled **Novend POS vX.Y.Z**.

---

## Unreleased

### Added

- Product **import** from CSV/Excel with Novend template, synonym header mapping, preview/validation, and Dexie+outbox writes. Quantity is opening stock on new SKUs only.
- Shared **export** menu (CSV, Excel, PDF, JSON) on Products, Reports, and Analytics. Product export includes the live catalog fields (cost only when the role may see it). Excel/PDF follow Pro rank.
- Plan **capabilities** on the licence snapshot (`canExportXlsx`, `maxImportRows`, …) so screens do not hard-code plan keys. Super Admin sees per-organization import/export limits, usage, recent jobs, and product-override history — not platform totals only.
- Wholesale **Record purchase** sets catalog **cost** and **selling** prices so a supplier increase is what branches sell after issue. Recent purchases list those line prices. **New product** on the same dialog adds a catalog SKU (no opening branch stock); quantity is received into the warehouse.
- Sales cart, discount, and attached customer stay in the tab when you leave Sales and come back. Checkout, hold, and sign-out clear that draft.
- Sales product cards show **on-hand stock** so cashiers do not need Inventory to see quantity.
- Settings → Devices can **shut down all except this device**, so administrators free every other activation slot in one action.
- Shut-down terminals can be **re-enabled** (uses a slot again) or **removed** from Settings → Devices.

### Changed

- You cannot set your own account inactive, deactivate the organization owner, or deactivate a user who is currently signed in.
- The device you are using cannot be shut down or removed. Other activated terminals still can.
- Dashboard **Top Selling** ranks by quantity by default. Quantity / Amount is a device preference and works offline.

### Fixed

- Platform super-admin sign-in opens `/platform` instead of tenant Dashboard (which threw `branches:list` Forbidden).
- Settings → Devices marks and counts **this device** using a client fingerprint (it was previously an empty SSR value, so the current terminal did not match).
- Login → dashboard no longer flashes Chrome’s “This site can’t be reached” (`ERR_FAILED`). The service worker was intercepting `/login`, following the auth redirect, and returning a redirected document — Chrome rejects that for navigations. Auth pages now bypass the worker; other documents are network-first with redirects unwrapped.
- Sync Center **Fix** opens the product when Convex rejects an upload (for example expiry date required on opening stock). Those rejections no longer sit in Waiting, retry the same payload forever, or block other queued products. Import requires YYYY-MM-DD when tracking expiry on opening stock.
- Capacitor checkout **Pay** completes on the device first (same as other POS writes). A false-online network no longer sends the sale to Convex, fail, and then apply every tap when the device reconnects. Print failure no longer looks like a failed payment.
- PDF exports use a spaced table layout. Image URLs are omitted unless the cell is an actual image file or data URI (CSV/Excel still include the URL).
- Capacitor no longer registers the service worker (Android WebView treats the same redirect as a stuck `net::ERR_FAILED` on `/dashboard`). Offline on mobile stays Dexie + the local boot page. Cold start opens `/api/boot` first so an already-installed worker cannot intercept `/dashboard`.
- Boot health checks no longer send `Cache-Control` (that forced a CORS preflight from `https://localhost`).

---

## v0.3.8 — 2026-08-27

### Fixed

- Cap/Electron boot checks `/api/health` before opening the hosted app, so a dead network shows Novend’s retry screen instead of Chrome’s “This page couldn’t load”.
- Android recovers failed hosted navigations (`net::ERR_FAILED`) onto the local boot page (`?stay=1`) and a branded `error.html`, not Chrome’s “webpage could not be loaded” sheet.
- Capacitor production config no longer remote-`loadUrl`s the hosted origin (that load is what painted `ERR_FAILED`).
- Service worker no longer rejects failed fetches (that also painted Chrome’s error sheet) and precaches Privacy, Terms, Help, and Download.
- Warehouse “Issue to branch” keeps the new quantity and transfer on the page until the server snapshot arrives.
- Outbox retries for wholesale, inventory, and expenses are idempotent so a lost response cannot double-apply stock.

### Changed

- Settings → Downloads lists the Android APK (and iOS when published) next to desktop installers.
- Settings → Backups combines this-device and cloud backups. New backups require a 12-character password (uppercase, lowercase, number) and confirmation; unencrypted files cannot be restored.
- Mobile checkout honors Automatic / Manual / Do not print; Print (one copy) is the primary post-sale action.
- CI runs on `staging`. Squash-merge `staging` → `main` for a clean release commit; Actions then merge-commits `main` back into `staging` so the next release PR does not conflict.

---

## v0.3.7 — 2026-08-26

### Fixed

- Cap cold start boots `/dashboard` (not `/login`), so signed-in opens no longer flash the login brand animation.
- Cap leave-login uses a single `location.replace` so dashboard is not stacked under splash/login chrome.
- Activated devices distinguish Android/iOS app vs browser (`runtime` android/ios/web).
- Cold reopen (`fromBoot`) restores the last in-app route; credential login still always lands on Dashboard.

---

## v0.3.6 — 2026-08-26

### Fixed

- Cap boot hands off to the cached shell when offline instead of a system “can’t reach Vercel” page.
- Unauthorized routes show a branded access-denied screen (no Chromium/Vercel error sheet).
- Offline session lasts 30 days; Cap resumes from cache without forcing online login on every cold start.
- About → Privacy / Terms / Help open as public pages (no longer trapped as “unavailable offline”).
- Mobile update check allows CORS from the hosted app so “Latest verified” works when Convex has a release.

### Changed

- Development continues on `staging`; merge to `main` via PR because of branch protection.

---

## v0.3.5 — 2026-08-25

### Fixed

- Align package version with release tag; Android release signing + CI audit hygiene.
- Cap shell scroll resets on route change; PWA sidebar closes after navigation; shared mobile dialog insets.
- Cap/PWA cart drawer dark overlay; dashboard action alignment; curved Cap bottom nav.

### Changed

- Subscription plan changes are now a lifecycle on one subscription: upgrades take effect after a prorated payment; downgrades are scheduled for the end of the paid period with no charge today.
- Pro is GH₵450 / month (GH₵4,500 / year). Enterprise is shown as GH₵750+, not a fixed 750. Yearly prices stay 10 × monthly on every recurring plan.

### Fixed (carried from unreleased)

- After sign-in, navigate immediately to the post-auth path (no wait on reactive `me` + no instant `router.refresh()`), so `/login` no longer stays blank until reload.
- In-app navigation stays instant online: client shell routing (same as offline) plus stale-while-revalidate SW (`novend-pos-v6`); removed `(app)/loading.tsx` full-page skeleton flash.

---

## v0.3.4 — 2026-08-25

### Fixed

- Capacitor camera barcode uses bundled ZXing by default (no Google ML Kit / HTTPS module); scanner starts without Try Again and cleans up streams on reopen.
- Product Take photo / gallery uses reliable Cap camera capture so Android no longer returns empty photos as “Could not capture”.
- Biometrics maps hardware supported / enrolled / available correctly; launch gate no longer fail-opens mid-prompt.
- Notifications distinguish prompt / granted / denied / error / unavailable; Android app-settings and notification channel wiring for permission recovery.
- Service worker and Settings native checks updated for Cap permission / resume stability.

---

## v0.3.3 — 2026-08-24

### Fixed

- Capacitor boot page passes `fromBoot=1` so cold start can restore the last in-app route after the hosted app loads.
- Bundles routing/deep-link and Settings native timeout fixes for sideloaded Android builds (hosted JS already on Vercel).

---

## v0.3.2 — 2026-08-23

### Fixed

- Capacitor Android cold start: local boot page client-navigates to the hosted app so offline reopen can use the service worker (same pattern as Electron).
- More, About, and extra POS routes are cached for offline navigation.
- Billing page renders from the last confirmed subscription while offline; payment still requires a connection.

---

## v0.3.1 — 2026-08-23

### Fixed

- Android release CI: make `gradlew` executable before assemble.
- Capacitor status strip / sticky titles so system icons stay readable and page titles no longer scroll away.
- About shows hosted app version plus native shell version/build.
- Sign out available on Capacitor More (header action + footer button).
- Compact header action icons on remaining list and detail screens.

---

## v0.3.0 — 2026-08-23

### Added

- Capacitor Android shell with bottom-nav POS UX, hardware abstraction, and native install path.
- Product Release CI builds desktop installers and an Android APK, then publishes metadata to Convex.
- Public `/download` page and install prompts read live desktop and mobile releases from Convex.
- Compact Capacitor page headers with scroll-aware action icons and status-bar safe area.

### Changed

- Landing nav: single Download link; mobile menu uses a one-at-a-time accordion.
- Install prompt prefers native downloads when a release exists; PWA only on mobile/iOS without one.

---

## v0.2.0 — 2026-08-21

### Added

- Dexie-first operational replica: wholesale, suppliers, inventory, customers, branches, users, expenses, returns, and profile stay usable without a network.
- Product photos cached in IndexedDB so catalog tiles still render offline.
- Outbox writes beyond sales/returns (`upsert_supplier`, wholesale receive/transfer, stock adjust/transfer, customers, expenses, profile).
- Clear offline error copy: “You're working offline” instead of `net::ERR_INTERNET_DISCONNECTED`.
- GitHub Release titles and notes now sync from this changelog after desktop publish.

### Changed

- Screens open from the local replica when it is warm; Convex is a freshness shortcut, not a gate.
- Online-only admin walls removed from operational modules. First login, password changes, and Paystack checkout still need the internet.

---

## 0.1.4 — 2026-08-20

### Added

- Settings → Hardware: printer, barcode scanner discovery/config, and future-device placeholders
- Product image Take Photo (webcam) with client-side compression
- Sales barcode multi-match picker and offline SKU lookup gated by terminal scanner settings
- Desktop hardware IPC bridge (`novendDesktop`) for printers, scanners, and update status

### Changed

- Offline Electron boot aligned with Princellen (no terminal-state gate); background auto-sync cadence

## 0.1.3 — 2026-08-20

### Fixed

- Packaged Electron now loads https://novend-pos.vercel.app (the previous default, novend.app, does not resolve)
- Hosted app URL is baked into the installer at build time instead of reading a CI-only env var at runtime
- First-run vs already-initialized desktop recovery copy

## 0.1.2 — 2026-08-19

### Fixed

- Desktop CI: TypeScript 5 rejects `ignoreDeprecations: "6.0"`, which failed every installer job
- Desktop updater dialog typing so `tsc` succeeds without a focused window

## 0.1.0 — 2026-08-19

First tagged desktop release of Novend POS.

### Added

- Electron desktop shell (`apps/desktop`) with offline boot page and GitHub Actions installer workflow for Windows, macOS, and Linux
- PWA service worker that caches the POS shell for offline refresh
- Platform Super Admin console with organization list and detail (usage, staff, branches, suspend/enable, plan, admin password reset)
- Wholesale warehouse stock: supplier purchases, then issue to branches
- Supplier directory with purchase history
- Optional auto-print receipts (admin/manager); receipts print without a logo
- User presence: online, last active, last device

### Changed

- Public signup removed; organizations are created only by Super Admin
- Branch restocking is transfer-from-wholesale, not direct supplier receive
- Login form no longer duplicates the Novend wordmark (brand stays on the hero)
- Splash uses the N brandmark

### Notes

- Existing branch stock is left in place; new supplier buys go to wholesale first
- Packaged desktop apps load the hosted Next.js app (`NOVEND_APP_URL`)
