# NOVEND POS

## Project Constitution

Version: 1.0.0

> **Authority**
>
> This document is the highest authority governing the Novend POS project.
> All architectural decisions, coding standards, UI/UX decisions, and AI-generated
> implementations must conform to this Constitution.
> If another document conflicts with this Constitution, the Constitution takes
> precedence until it is intentionally revised.

---

# 1. Vision

Novend POS is a commercial, multi-tenant Point of Sale and business management
platform. It productizes the workflows proven in Princellen POS so any product-based
business can operate independently inside its own isolated organization.

The name is **Nova + Vend**: new selling. The product should feel suitable for a
single shop and for a growing multi-branch business without requiring a rewrite.

Internet should enhance the business, not control it. Cashiers complete sales
locally; the cloud authenticates, authorizes, validates, and commits canonical state.

---

# 2. Mission

Build production-grade commercial POS software that is:

- Fast at the counter
- Accurate in inventory and money
- Isolated per organization
- Maintainable as a long-lived product
- Consistent in design and architecture

Optimize for the long-term health of the codebase, not only for finishing the
current request.

---

# 3. Product objectives

- **Simplicity** — common tasks with few interactions
- **Speed** — POS search, cart, and checkout feel immediate
- **Reliability** — inventory, sales, and reports stay internally consistent
- **Multi-tenancy** — one platform, many independent businesses
- **Offline resilience** — critical selling continues without a live network
- **Maintainability** — a new engineer can find the right file quickly
- **Professional quality** — never feel like a prototype

---

# 4. Relationship to Princellen POS

Princellen POS is the single-tenant reference implementation.

Novend **keeps**:

- Feature-first folders
- Convex as the authority for committed business state
- Dexie as the local-first operational cache and outbox
- Immutable completed sales
- Non-negative inventory with recorded reasons
- Role-based access, validators, audit logs
- Design-system tokens, navy sidebar, POS-density layouts

Novend **changes**:

- Every business row is stamped with `organizationId`
- Organizations are created only by a platform Super Admin; staff accounts are invite-only
- Currency, tax ID, and receipt identity are per organization
- Brand, copy, and catalog are industry-agnostic

Novend is **not** a git fork. Algorithms and patterns are ported and generalized.

---

# 5. Architectural decision: local-first UX, Convex authority

IndexedDB is **not** the source of truth.

```text
UI → Dexie (paint + offline writes) → Outbox (operations) → Convex (commit)
```

- Cashiers do not wait for the network to finish a sale.
- Convex is the source of truth for committed stock, invoices, users, and isolation.
- Sync conflicts: server validation wins. Negative stock is never accepted.
- Failed outbox rows surface for retry or discard.

Do not drift back to “IndexedDB is the database.” That would break tenant isolation
and cross-device inventory integrity.

---

# 6. Feature-first architecture

```text
UI → Application logic → Business logic → Convex → Database
```

```text
app → features → components → hooks → lib → convex
```

- `app/` is routing and page assembly only
- `features/` own feature UI
- `components/` are business-agnostic
- `convex/` owns schema, authz, validation, and business rules
- Dependencies point downward only
- One file, one responsibility

Do not start with a packages monorepo. Extract packages when a second consumer
exists (for example a separately versioned desktop shell).

---

# 7. Non-negotiable business rules

- Inventory cannot become negative.
- Inventory never changes without a recorded business reason.
- Completed sales are immutable. Corrections use linked return workflows (later slice).
- Every completed sale produces exactly one immutable receipt.
- Sale lines snapshot name, quantity, and prices at the moment of sale.
- Prefer archive/deactivate over permanent deletion of business records.
- Important actions remain attributable to user, time, and operation.

All rules are enforced in Convex. The UI never decides business outcomes.

---

# 8. Multi-tenant isolation

The organization is the primary business boundary.

- Resolve `organizationId` from the authenticated profile, never from client args.
- After `ctx.db.get(id)`, assert the document belongs to the session organization.
- SKUs, invoice numbers, and settings are unique **per organization**.
- One Convex Auth user belongs to exactly one organization in this slice.
- The local Dexie database name includes `organizationId`.

A user from Organization A must never read or write Organization B.

---

# 9. Roles

| Role                                | Scope                                                            |
| ----------------------------------- | ---------------------------------------------------------------- |
| Owner (`organizations.ownerUserId`) | Organization creator; cannot be deactivated in this slice        |
| Administrator                       | Full in-org operations (catalog, users, settings, sales)         |
| Manager                             | Assigned branch operations; catalog and inventory                |
| Cashier                             | Sales, holds, receipts, customers; no catalog/pricing/user admin |

Users cannot deactivate their own account. A signed-in account cannot be set
inactive until they sign out.

Permissions come from roles, not from hiding buttons.

---

# 10. Security

Security is designed in.

Every Convex function that touches business data must authenticate, authorize
(role + organization + branch), validate input, and enforce business rules.

Least privilege. No secrets in source or client bundles. Cost prices are not
returned to cashiers. Fail closed.

---

# 11. Design philosophy

Every screen must feel like the same product.

- Tokenized color, type, spacing, radius, shadow
- Navy sidebar, light canvas, Novend teal primary
- Large intentional whitespace, clear hierarchy, predictable states
- Accessibility is part of implementation (keyboard, focus, labels, contrast)

---

# 12. Documentation

Documentation is part of the implementation.

When architecture, public Convex contracts, folder ownership, or business rules
change, update the relevant document in the same change.

---

# 13. AI and engineering behavior

Act like a principal engineer. Question poor decisions. Prefer extending existing
modules over parallel implementations. Leave the codebase better than before.
