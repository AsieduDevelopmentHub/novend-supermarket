# Database Schema

Version: 1.0.0

Defined in `convex/schema.ts`. See also [`MULTI_TENANT.md`](./MULTI_TENANT.md).

## Tenancy

Every business table includes `organizationId`. Indexes that enforce uniqueness
or drive hot queries **start with** `organizationId`.

## Core tables

- `organizations` — name, slug, status, ownerUserId, currency, planKey,
  subscriptionId, trialEndsAt, backupLimitBytes (Enterprise quota override)
- `plans` — catalog mirror of `convex/shared/plans.ts` plus gateway plan codes
- `subscriptions` — one live licence per organization
- `devices` — activated terminals counted against the plan
- `billingHistory` — checkout and webhook payment records
- `cloudBackups` — cloud backup blobs counted against the storage quota
- `users` / auth tables — Convex Auth (global identity)
- `profiles` — name, role, organizationId, branchId, status, appearance
- `branches` — name, unique code per org, status (MVP: MAIN)
- `categories` — name, slug unique per org
- `products` — catalog (pricing, unit, low-stock, optional expiry tracking)
- `branchStock` — per-branch on-hand quantity
- `inventoryLots` — dated batches; FEFO for dated SKUs
- `inventoryHistory` — quantity changes with reason
- `customers` — organization-wide
- `sales` / `saleItems` / `saleItemLots` — immutable completed transactions
- `saleClientOps` — idempotency keys for `completeSale`
- `heldSales` — suspended carts
- `receipts` — immutable JSON payloads
- `settings` — key/value per organization
- `auditLogs` — traceability
- `loginAttempts` — brute-force protection

Reports are derived queries, not a dedicated table.

Client offline mirror (Dexie) is documented in [`OFFLINE_SYNC.md`](./OFFLINE_SYNC.md);
it is not a Convex table.

## Uniqueness (per organization)

- SKU
- Category slug
- Branch code
- Invoice number
- Organization slug (global)
