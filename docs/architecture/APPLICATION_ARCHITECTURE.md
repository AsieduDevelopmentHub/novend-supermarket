# Application Architecture

Version: 1.0.0

```text
UI (app/ + features/)
  → hooks / providers / services
  → Convex queries/mutations  (+ IndexedDB offline mirror)
  → schema + business rules
  → database

Desktop (later):
  Electron renderer loads the same UI
  → preload bridge
  → native hardware adapters
```

## Layers

| Layer | Location |
|-------|----------|
| Routes / layouts | `app/` |
| Feature modules | `features/` |
| Foundation UI | `components/` |
| Shared utils | `lib/`, `hooks/` |
| Print / OS bridge | `services/` |
| Backend | `convex/` |
| Config | `config/`, `constants/` |

## Deployment targets

- **Web** — browsers, tablets (this slice)
- **PWA** — cached shell + Dexie for offline selling
- **Desktop** — future Electron shell; not built here

## Data flow

```text
Cashier UI
  → Dexie (paint + offline writes)
  → Outbox (operation events)
  → Convex (authz, validation, commit)
  → Dexie mirror refresh
```

Convex is the source of truth for committed business state.
Dexie is the operational cache. See `OFFLINE_SYNC.md` and `MULTI_TENANT.md`.

## MVP modules

- Auth, onboarding, app shell
- Dashboard (today summary)
- Products, categories, inventory
- POS, holds, receipts, orders
- Customers (light)
- Users (in-org)
- Settings (business, receipt, appearance)
- Offline sales outbox
