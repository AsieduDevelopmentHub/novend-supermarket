# Offline Sync

Version: 2.4.0

## Purpose

Keep every operational Novend screen usable without a network. Dexie is the
**operational replica** the UI reads and writes. Convex remains the
**committed cloud replica**: it authenticates, authorizes, validates, and
stores canonical state when a device is online.

This is local-first operations, not a second source of truth. Negative
inventory and immutable completed sales are still enforced when the outbox
drains to Convex.

## Data flow

```text
UI
↓
Repository / Dexie replica
↓
Sync outbox
↓
Convex (when online)
```

1. While online, `offline.getSnapshot` pulls a branch-scoped replica into IndexedDB
   (catalog, customers, orders, suppliers, wholesale, branches, users, expenses,
   returns, product photos).
2. Screens always render from Dexie when the replica is warm. Live Convex is
   used as a freshness shortcut, never as a gate to open the page.
3. Writes apply locally, then enqueue an outbox event (`upsert_supplier`,
   `record_wholesale_purchase`, `complete_sale`, …).
4. `OfflineProvider` drains the outbox in the background. Forms return as soon as
   Dexie succeeds — loading spinners never wait on Convex.
5. Product photos live in IndexedDB (`productImages`) as blobs plus thumbnails.
   The UI reads local blobs first and falls back to the cloud URL only when the
   replica has no photo yet.
6. The dashboard is built only from Dexie (`buildLocalDashboardSummary`). It
   never calls Convex `dashboard.summary`. Restock, sales, and returns refresh it
   via `replica-changed`.
7. Barcode scans look up `products.barcode` (then SKU) in Dexie only.

## Local writes

`persistBusinessWrite` always applies the Dexie + outbox path, then asks the
provider to flush while online. Branch create/update and product create (including
photos) use that path. Returns always call `processReturnLocally`.

## Startup

Network checks never block rendering.

```text
Load Dexie
↓
Restore session
↓
Render from local modules
↓
Check connectivity in the background
↓
Pull snapshot + drain outbox
```

## What still needs a connection

These cannot complete locally without weakening security or talking to a
payment network:

- First login, signup, and onboarding
- Creating a new login (password is stored by Convex Auth)
- Changing a password
- Paystack checkout and live billing mutations
- Cloud backup upload/download
- Desktop auto-update download

Name, phone, catalog, inventory, wholesale, suppliers, customers, expenses,
sales, returns, reports, and analytics all continue on the device.

## Conflict policy

Queue order + server validation. Inventory cannot become negative on Convex.
Cashiers resolve failed syncs (retry or discard). Local `local_*` ids are
remapped after creates succeed.

The sidebar chip is the only always-on offline indicator. The top banner
appears only for active uploads and sync conflicts. **Sync Center** (from the
chip) lists waiting uploads, server conflicts, and recently synced events.
**Sync now** bypasses retry backoff and re-queues failed rows. Forbidden,
duplicate, and stock rejections stay as conflicts instead of silent pending.

## Offline navigation

Next.js App Router RSC fetches fail offline. While offline, in-app navigation
uses `history.pushState` and a client outlet so the authenticated layout stays
mounted.

## Super Admin (platform)

Platform console screens use the same IndexedDB stack under a dedicated
`novend-offline-platform-{userId}` replica. While online, overview, organization
lists, org detail, and release metadata are written into Dexie `meta`. While
offline, those screens paint from cache; mutating tenants (create org, reset
password, license edits) still requires a connection.

## Desktop and Capacitor

Electron first-run must load the hosted app so the service worker and Dexie
initialize. Later launches client-navigate from a local boot page. See
`DESKTOP_PLATFORM.md`.

Capacitor Android/iOS use the same boot pattern (`apps/mobile/www/index.html`)
instead of a remote `server.url` load. See `CAPACITOR_MOBILE.md`.

## Billing (offline-aware)

Settings → Billing renders from Dexie (`billingOverview`, `billingHistory`,
`licenseSnapshot`). Pay / Subscribe / Upgrade / Renew require a connection and
must not hide the rest of the billing page or lock the POS. Downgrades that
exceed the target plan limits are rejected in Convex; existing records are never
deleted. The last valid licence snapshot keeps selling while offline.
