# Convex Architecture

Version: 1.0.0

Engineering practices: [`docs/development/06-CONVEX_GUIDE.md`](../development/06-CONVEX_GUIDE.md)

Schema: [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md)

Auth: `@convex-dev/auth` Password provider in `convex/auth.ts`.

Shared helpers: `convex/shared/permissions.ts`, `validation.ts`, `audit.ts`.

## Ownership

Convex owns authentication, authorization, queries, mutations, actions, database,
realtime, and file storage.

Do not introduce another primary backend.

## Layout

```text
convex/
├── schema.ts
├── auth.ts
├── organizations.ts
├── users.ts
├── products.ts
├── inventory.ts
├── sales.ts
├── ...
└── shared/
    ├── permissions.ts
    ├── validation.ts
    └── audit.ts
```

Organize by domain, not by UI screen.

## Function contract

Every public function that touches business data must:

1. Authenticate
2. Resolve organization from the session profile (never from client `organizationId`)
3. Authorize role and branch
4. Validate input
5. Enforce business rules
6. After `db.get`, assert the document belongs to the session organization

## Frontend contract

The UI talks to Convex only through queries, mutations, and actions.
