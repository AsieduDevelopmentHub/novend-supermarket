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

1. Public email/password signup is enabled.
2. Users without a profile are forced to `/onboarding`.
3. `organizations.create` in one mutation: organization, MAIN branch, owner
   profile (`administrator`), default settings.
4. Further staff are created by in-org administrators/managers, not public signup.

# Isolation rules

- Never trust `args.organizationId`.
- `requireOrgContext(ctx)` reads org from the authenticated profile.
- `assertOrgDoc(doc)` after every `db.get` of a business record.
- Queries use `organizationId` indexes; do not `collect()` the whole table.
- Dexie database name: `novend-offline-${organizationId}`.
- Offline snapshots are org + branch scoped.

# Roles

- `organizations.ownerUserId` — cannot be deactivated in this slice
- `administrator` | `manager` | `cashier` — Princellen capability map, always
  scoped to the session organization (and branch for manager/cashier)

Platform super-admin and billing are out of scope.

# IDOR test

Two organizations on one deployment must not read or write each other’s rows,
including by guessing Convex document IDs.
