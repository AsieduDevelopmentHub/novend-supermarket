# Novend POS — Mobile (Capacitor)

Phase 1 shell only. This package wraps the **same** hosted Next.js application that
Electron loads. It does **not** duplicate pages or business logic.

## Architecture

```text
apps/mobile (Capacitor WebView)
        │
        ▼  local www/index.html → client-navigate → https://novend-pos.vercel.app/dashboard
Shared Next.js app (root)
        │
        ├── Dexie / offline outbox (unchanged)
        ├── Convex (authority)
        └── @novend/hardware → Capacitor adapters
```

Production APKs start from the packaged boot page (same idea as Electron
`offline-boot.html`) so a cold start while offline can still reach the cached
service worker. HTTP `NOVEND_APP_URL` keeps live-reload `server.url` for
LAN/emulator development.

Native camera, barcode, and Bluetooth printing are **not** implemented in this phase.

## Prerequisites

- Node / pnpm from the monorepo root
- Android Studio (for Android)
- Xcode on macOS (for iOS)

## Setup

From the repo root:

```bash
pnpm install
pnpm --filter @novend/mobile add:android   # once
pnpm --filter @novend/mobile add:ios       # once, macOS only
cd apps/mobile && npx cap sync
```

Native plugins (synced into Android/iOS): Camera, Filesystem, Share, Local
Notifications, Biometrics, BLE. Camera barcode scanning uses bundled ZXing in
the WebView (not Google ML Kit).

Point at a local Next.dev server while developing:

```bash
# Physical device on Wi‑Fi (use your machine's LAN IP from `pnpm dev` output)
set NOVEND_APP_URL=http://192.168.1.202:3000
npx convex env set SITE_URL http://192.168.1.202:3000
pnpm mobile:sync

# Android emulator (host alias)
set NOVEND_APP_URL=http://10.0.2.2:3000
npx convex env set SITE_URL http://10.0.2.2:3000
pnpm mobile:sync
```

`SITE_URL` in Convex must match `NOVEND_APP_URL` exactly. Novend patches `@convex-dev/auth`
so LAN/emulator HTTP dev hosts use non-secure cookies (mobile WebViews drop `Secure`
cookies on plain HTTP — you'll see "missing refreshToken cookie" in the Next.js log).

After changing URLs, restart `pnpm dev`, force-close the app, and sign in again.

## Scripts

| Script                                  | Purpose                                       |
| --------------------------------------- | --------------------------------------------- |
| `pnpm mobile:sync`                      | Sync web assets + config into native projects |
| `pnpm mobile:open:android`              | Open Android Studio                           |
| `pnpm --filter @novend/mobile open:ios` | Open Xcode (macOS)                            |

## Phase 2 hardware

Camera, gallery, in-app ZXing barcode, PDF save, and share go through
`@novend/hardware` Capacitor adapters. Bluetooth printing is Phase 3.

## Do not

- Create a React Native tree
- Copy `app/` or `features/` into this package
- Replace Dexie / IndexedDB with SQLite
- Call Capacitor plugins from UI components
