# Multi-Tenant Architecture

Version: 1.0.0

# Decision

Novend is a **logical multi-tenant** platform on one Convex deployment.
The organization is the isolation boundary.

IndexedDB is not a per-tenant source of truth. Convex is.

# Model

```text
Novend platform
├── Organization A
│   ├── Users / profiles
│   ├── Branches (MAIN in MVP)
│   ├── Catalog + branch stock
│   └── Sales / receipts
└── Organization B
    └── …
```

# Membership (this slice)

One Convex Auth user belongs to exactly one organization
(`profiles.organizationId`). Multi-org membership is a later feature.

# Onboarding

1. A business owner signs up at `/signup` and creates the organization during
   `/onboarding`. That provisions MAIN, an owner `administrator` profile,
   default settings, and a **14-day Pro trial**.
2. A Novend platform administrator can also provision a tenant with
   `platform.createOrganization` (trial or an assigned plan).
3. Further staff are created by in-org administrators/managers.

# Isolation rules

- Never trust `args.organizationId`.
- `requireOrgContext(ctx)` reads org from the authenticated profile.
- `assertOrgDoc(doc)` after every `db.get` of a business record.
- Queries use `organizationId` indexes; do not `collect()` the whole table.
- Never list business rows by a global `by_status` (or similar) index.
- Dexie database name: `novend-offline-${organizationId}`.
- Offline snapshots are org + branch scoped.

# Roles

- `organizations.ownerUserId` — cannot be deactivated in this slice
- A signed-in (presence online) account cannot be set inactive until they sign out
- Users cannot deactivate their own account
- `administrator` | `manager` | `cashier` — Princellen capability map, always
  scoped to the session organization (and branch for manager/cashier)

Platform super-admin (`platformAdmins`) sits outside organization RBAC.
Sign-in opens `/platform`, not tenant Dashboard. Tenant queries such as
`branches:list` are not called for a platform-only session.
Billing, plans and activation are documented in [`BILLING.md`](./BILLING.md).

# IDOR test

Two organizations on one deployment must not read or write each other’s rows,
including by guessing Convex document IDs.
