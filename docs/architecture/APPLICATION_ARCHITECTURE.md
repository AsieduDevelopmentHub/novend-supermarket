# Application Architecture

Version: 1.0.0

```text
UI (app/ + features/)
  → hooks / providers / services
  → Convex queries/mutations  (+ IndexedDB offline mirror)
  → schema + business rules
  → database

Desktop:
  Electron loads https://novend-pos.vercel.app (baked appUrl)
  → persist:novend session (SW + Dexie)
  → preload bridge
  → native hardware / auto-update
```

## Layers

| Layer             | Location                |
| ----------------- | ----------------------- |
| Routes / layouts  | `app/`                  |
| Feature modules   | `features/`             |
| Foundation UI     | `components/`           |
| Shared utils      | `lib/`, `hooks/`        |
| Print / OS bridge | `services/`             |
| Backend           | `convex/`               |
| Config            | `config/`, `constants/` |

## Deployment targets

- **Web** — browsers, tablets
- **PWA** — cached shell + Dexie for offline selling
- **Desktop** — Electron shell at `apps/desktop`; first launch needs the hosted app, then offline from cache + Dexie
- **Mobile** — Capacitor shell at `apps/mobile`; same hosted Next app + `@novend/hardware` (camera, barcode, BLE print, biometrics, backup). See `CAPACITOR_MOBILE.md`.

Hardware access for all targets goes through `packages/hardware` (`@novend/hardware`).

## Data flow

```text
Cashier UI
  → Dexie (paint + offline writes)
  → Outbox (operation events)
  → Convex (authz, validation, commit)
  → Dexie mirror refresh
```

Convex is the source of truth for committed business state.
Dexie is the operational cache. See `OFFLINE_SYNC.md`, `MULTI_TENANT.md`, and `DESKTOP_PLATFORM.md`.

## MVP modules

- Auth, onboarding, app shell
- Dashboard (today summary)
- Products, categories, inventory
- POS, holds, receipts, orders
- Customers (light)
- Users (in-org)
- Settings (business, receipt, appearance)
- Offline sales outbox
