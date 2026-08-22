# Offline Sync

Version: 2.1.0

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
4. `OfflineProvider` drains the outbox when the network returns. Server
   validation wins; failed business conflicts stay on the device for the cashier
   to retry or discard.

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

The sidebar chip opens **Sync Center**: waiting uploads, server conflicts, and
recently synced events. A catalog refresh must not look like the outbox is empty.
**Sync now** bypasses retry backoff and re-queues failed rows. Forbidden,
duplicate, and stock rejections stay as conflicts instead of silent pending.

## Offline navigation

Next.js App Router RSC fetches fail offline. While offline, in-app navigation
uses `history.pushState` and a client outlet so the authenticated layout stays
mounted.

## Desktop

Electron first-run must load the hosted app so the service worker and Dexie
initialize. Later launches client-navigate from a local boot page. See
`DESKTOP_PLATFORM.md`.
