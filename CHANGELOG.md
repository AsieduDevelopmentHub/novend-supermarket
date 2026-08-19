# Changelog

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
