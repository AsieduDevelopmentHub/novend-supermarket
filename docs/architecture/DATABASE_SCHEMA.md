# Database Schema

Version: 1.3.0

Defined in `convex/schema.ts`. See also [`MULTI_TENANT.md`](./MULTI_TENANT.md).

## Tenancy

Every business table includes `organizationId`. Indexes that enforce uniqueness
or drive hot queries **start with** `organizationId`.

## Core tables

- `organizations` — name, slug, status, ownerUserId, currency, planKey,
  subscriptionId, trialEndsAt, backupLimitBytes (Enterprise quota override)
- `plans` — catalog mirror of `convex/shared/plans.ts` plus gateway plan codes
- `subscriptions` — one live licence per organization
- `devices` — activated terminals counted against the plan; shut-down rows can
  be re-enabled or removed from Settings → Devices
- `billingHistory` — checkout and webhook payment records
- `cloudBackups` — cloud backup blobs counted against the storage quota
- `users` / auth tables — Convex Auth (global identity)
- `profiles` — name, role, organizationId, branchId, status, appearance
- `branches` — name, unique code per org, status (MVP: MAIN)
- `categories` — name, slug unique per org
- `products` — catalog (pricing, unit, low-stock, optional expiry tracking)
- `branchStock` — per-branch on-hand quantity
- `suppliers` / `supplierPurchases` / `supplierPurchaseItems` — warehouse buys; line `unitCost` and optional `unitSellingPrice` snapshot the catalog prices applied on receive
- `wholesaleStock` / `wholesaleLots` — supplier stock before issue to a branch
- `branchStock` — per-branch on-hand quantity
- `inventoryLots` — dated batches; FEFO for dated SKUs
- `inventoryHistory` — quantity changes with reason
- `customers` — organization-wide
- `sales` / `saleItems` / `saleItemLots` — immutable completed transactions
- `saleClientOps` — idempotency keys for `completeSale`
- `saleReturnClientOps` — idempotency keys for `processReturn`
- `mutationClientOps` — idempotency keys for wholesale, inventory, expenses, and other outbox mutations
- `heldSales` — suspended carts
- `receipts` — immutable JSON payloads
- `settings` — key/value per organization
- `importJobs` — catalog import results (counts only; spreadsheets are not stored). Super Admin reads these per organization.
- `importMappings` — saved product column mappings per organization
- `exportEvents` — export format usage for Super Admin (not a billed quota). Visible per organization on the platform org screens.
- `auditLogs` — traceability
- `platformEvents` — 90-day privacy-limited product and operational telemetry
- `platformDailyActiveUsers` — one pseudonymous active-user row per UTC day
- `platformDailyRollups` — durable Super Admin monitoring aggregates
- `releaseDownloadBaselines` — immutable historical GitHub asset totals
- `userTourProgress` — versioned, user-owned onboarding progress
- `loginAttempts` — brute-force protection

Reports are derived queries, not a dedicated table.

Client offline mirror (Dexie) is documented in [`OFFLINE_SYNC.md`](./OFFLINE_SYNC.md);
it is not a Convex table.

## Uniqueness (per organization)

- SKU
- Category slug
- Branch code
- Invoice number (allocated at checkout; sync must not replace the printed value)
- Return number (`saleReturns.by_organization_returnNumber`)
- Supplier purchase reference (`supplierPurchases.by_organization_reference`)
- Organization slug (global)
