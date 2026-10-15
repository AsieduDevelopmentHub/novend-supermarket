# Application Architecture

Version: 1.0.0

```text
UI (app/ + features/)
  → hooks / providers / services
  → Convex queries/mutations  (+ IndexedDB offline mirror)
  → schema + business rules
  → database

Desktop (Millie's):
  Electron starts bundled Next standalone on 127.0.0.1
  → BrowserWindow loads http://127.0.0.1:<port>
  → persist:millies session + Dexie
  → preload bridge → native hardware
```

## Layers

| Layer             | Location                |
| ----------------- | ----------------------- |
| Routes / layouts  | `app/`                  |
| Feature modules   | `features/`             |
| Foundation UI     | `components/`           |
| Shared utils      | `lib/`, `hooks/`        |
| Print / OS bridge | `services/`             |
| Backend           | `convex/` (validators only at Millie's runtime) |
| Config            | `config/`, `constants/` |

## Deployment targets

- **Web** — browsers, tablets (local `pnpm dev` / optional deploy)
- **Desktop** — Electron at `apps/desktop`; packs Next `output: "standalone"` and serves it on loopback (no hosted Novend URL)
- **Android** — Capacitor shell at `apps/mobile`. See `CAPACITOR_MOBILE.md`.

Hardware access for all targets goes through `packages/hardware` (`@novend/hardware`).

## Data flow

```text
Cashier UI
  → Dexie (authority when FULLY_OFFLINE)
```

Millie's: Dexie is the source of truth. See `MILLIES_OVERVIEW.md`, `OFFLINE_SYNC.md`, and `DESKTOP_PLATFORM.md`.

## Configurable capabilities (future / in design)

Industry packs and sell modes (multi-unit, weight, etc.) are specified as a
capability engine—not industry forks. Principles and target model:
[`NOVEND_CAPABILITY_EXPANSION.md`](./NOVEND_CAPABILITY_EXPANSION.md). Phased,
flag-gated delivery: [`ROADMAP_CAPABILITIES.md`](./ROADMAP_CAPABILITIES.md).

## MVP modules

- Auth, onboarding, app shell
- Dashboard (7-day ops summary; today for cashiers)
- Products, categories, inventory
- POS, holds, receipts, orders
- Customers (light)
- Users (in-org)
- Settings (business, receipt, appearance)
- Offline sales outbox
