# Database Schema

Version: 1.3.2

Defined in `convex/schema.ts`. See also [`MULTI_TENANT.md`](./MULTI_TENANT.md).

## Tenancy

Every business table includes `organizationId`. Indexes that enforce uniqueness
or drive hot queries **start with** `organizationId`.

## Core tables

- `organizations` — name, slug, status, ownerUserId, currency, planKey,
  subscriptionId, trialEndsAt, backupLimitBytes (Enterprise quota override),
  cloudMode, entitlementVersion (monotonic; missing → 0), and optional Super Admin
  entitlement overrides: allowedCloudModes (missing → all modes),
  cloudBackupEnabled / remoteMonitoringEnabled (missing → enabled)
- `plans` — catalog mirror of `convex/shared/plans.ts` plus gateway plan codes
- `subscriptions` — one live licence per organization
- `devices` — activated terminals counted against the plan; shut-down rows can
  be re-enabled or removed from Settings → Devices
- `billingHistory` — checkout and webhook payment records
- `cloudBackups` — cloud backup blobs counted against the storage quota
- `users` / auth tables — Convex Auth (global identity)
- `profiles` — name, role, organizationId, branchId, status (`active` /
  `inactive` deactivation), optional `deactivatedAt` / `deactivatedBy`
- `staffCompensation` — per-profile salary amount/frequency and commission
  rate/basis. Payments are `expenses` rows, not a second ledger.
- `expenses` — operating costs including `salaries` and `commissions`; optional
  `beneficiaryProfileId`, `payPeriodKey`, `sourceKind`, `paymentStatus` for payroll
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
- `settings` — key/value per organization (`business.profile`, `receipt.template`,
  `pos.preferences`, `business.capabilities`)
- `importJobs` — catalog import results (counts only; spreadsheets are not stored). Super Admin reads these per organization.
- `importMappings` — saved product column mappings per organization
- `exportEvents` — export format usage for Super Admin (not a billed quota). Visible per organization on the platform org screens.
- `auditLogs` — traceability
- `platformEvents` — 90-day privacy-limited product and operational telemetry
- `platformDailyActiveUsers` — one pseudonymous active-user row per UTC day
- `platformDailyRollups` — durable Super Admin monitoring aggregates
- `organizationPlatformStats` — denormalized per-org counters (sales, products,
  users, branches, imports, exports) for Super Admin overview / org list without
  global `.collect()` on sales or products. Maintained on write paths; backfill
  via `platformStats.backfillOrganizationStats` after deploy.
- `platformStats` — deployment-wide singleton (`key: "global"`) with organization,
  cloud-mode, plan, and device/branch/user counters for overview KPI cards without
  scanning every organization. Maintained incrementally
  (`convex/shared/platformStatsAggregate.ts`) from `provisionOrganization`,
  `setOrganizationStatus`, `assignPlan`, and `setOrganizationCloudMode`; fully
  repairable via `platformStats.rebuild`.
- `platformDefaults` — deployment-wide Super Admin defaults (`key: "global"`),
  including catch-up sync boost TTL minutes. Org `cloudSyncBoostTtlMinutes`
  overrides this when set.
- `platformTelemetryHeartbeats` — minimal per-organization heartbeats (cloud mode,
  plan, entitlement version, branch/user/device counts, app version, storage
  estimate, last backup, outbox counts, `sentAt`). Written by
  `telemetry.recordHeartbeat` in every cloud mode (including `local_only`) and
  deduplicated to ~one row per 24h unless a field changes. Indexed
  `by_organization` and `by_organization_sentAt`. Separate from `platformEvents`.
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
