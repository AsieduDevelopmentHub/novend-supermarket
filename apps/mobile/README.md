# Novend POS — Mobile (Capacitor)

Phase 1 shell only. This package wraps the **same** hosted Next.js application that
Electron loads. It does **not** duplicate pages or business logic.

## Architecture

```text
apps/mobile (Capacitor WebView)
        │
        ▼  server.url → https://novend-pos.vercel.app
Shared Next.js app (root)
        │
        ├── Dexie / offline outbox (unchanged)
        ├── Convex (authority)
        └── @novend/hardware → Capacitor adapters (stubs in Phase 1)
```

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

Native plugins (synced into Android/iOS): Camera, Filesystem, Share, ML Kit Barcode Scanning.

Point at a local Next.dev server while developing:

```bash
NOVEND_APP_URL=http://10.0.2.2:3000 npx cap sync
```

(`10.0.2.2` is the Android emulator alias for the host machine.)

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm mobile:sync` | Sync web assets + config into native projects |
| `pnpm mobile:open:android` | Open Android Studio |
| `pnpm --filter @novend/mobile open:ios` | Open Xcode (macOS) |

## Phase 2 hardware

Camera, gallery, native barcode, PDF save, and share go through `@novend/hardware`
Capacitor adapters. Bluetooth printing is Phase 3.

## Do not

- Create a React Native tree
- Copy `app/` or `features/` into this package
- Replace Dexie / IndexedDB with SQLite
- Call Capacitor plugins from UI components