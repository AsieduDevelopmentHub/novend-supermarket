# Changelog

All notable changes to Novend POS are recorded here. The project follows [Semantic Versioning](https://semver.org/); each `vX.Y.Z` tag builds desktop installers and publishes a GitHub Release titled **Novend POS vX.Y.Z**.

---

## Unreleased

### Changed

- Subscription plan changes are now a lifecycle on one subscription: upgrades take effect after a prorated payment; downgrades are scheduled for the end of the paid period with no charge today.
- Pro is GH₵450 / month (GH₵4,500 / year). Enterprise is shown as GH₵750+, not a fixed 750. Yearly prices stay 10 × monthly on every recurring plan.

### Fixed

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
