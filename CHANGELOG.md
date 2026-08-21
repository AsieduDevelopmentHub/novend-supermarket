# Changelog

All notable changes to Novend POS are recorded here. The project follows [Semantic Versioning](https://semver.org/); each `vX.Y.Z` tag builds desktop installers and publishes a GitHub Release titled **Novend POS vX.Y.Z**.

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
