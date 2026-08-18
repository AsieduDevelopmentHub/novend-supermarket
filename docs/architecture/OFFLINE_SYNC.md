# Offline Sync

Version: 1.0.0

## Purpose

Keep the POS usable without a network for **sales checkout** and catalog/customer
reads, while Convex remains the authoritative source of truth.

**This is local-first UX, not a local source of truth.**

## Scope (this slice)

**Offline:**

- Browse mirrored products, inventory, customers, recent orders
- Navigate the app shell without RSC blank screens
- Complete sales (optimistic local receipt + stock decrement)
- Hold / resume carts on the current device
- Sync `complete_sale` when connectivity returns
- Dashboard from last snapshot or local sales

**Online-only:**

- First login / signup / onboarding
- Product, inventory, customer, user, settings writes
- Password changes and image uploads

## Components

| Area | Location |
|------|----------|
| Dexie DB | `lib/offline/db.ts` (`novend-offline-${organizationId}`) |
| Snapshot pull | `lib/offline/snapshot.ts`, `convex/offline.getSnapshot` |
| Outbox | `lib/offline/outbox.ts` |
| Sync drain | `lib/offline/sync-engine.ts` |
| Provider | `providers/offline-provider.tsx` |

## Data flow

1. While online, pull a branch-scoped catalog snapshot into IndexedDB.
2. Checkout writes a local sale + outbox row (`clientOperationId`), then prints
   a provisional invoice (`OFF-…`).
3. Sync calls Convex `sales.completeSale` with the same `clientOperationId`.
4. Server enforces org, branch, sellable stock, and records `saleClientOps`.
5. On success, local invoice is replaced with the server `INV-…` receipt.
6. On insufficient stock, the outbox row is `failed`, local stock is restored.

## Conflict policy

Queue order + **server validation**. Negative inventory is never accepted.
Cashiers resolve failed syncs (retry or discard).

## Offline navigation

Next.js App Router RSC fetches fail offline. While offline, in-app navigation
uses `history.pushState` and a client outlet so the authenticated layout stays
mounted. The service worker caches document shells and static chunks; RSC
failures return plain text, never HTML.
