# Novend POS

## Business Glossary

Version: 1.0.0

# Purpose

Shared vocabulary for product, engineering, and AI assistants.

# Organization

The tenant. A customer’s isolated business environment: users, branches, catalog,
inventory, sales, customers, settings. Every business-owned record belongs to one
organization.

# Owner

The user who created the organization (`organizations.ownerUserId`). Always an
administrator. Cannot be deactivated in this slice.

# Branch

A physical or logical selling location. Stock, sales, and holds are branch-scoped.
This slice creates a `MAIN` branch at onboarding. Multi-branch UI comes later.

# Profile

Application identity for an authenticated user: name, role, organization, branch,
status. Distinct from Convex Auth `users`.

# Product

A sellable SKU: name, category, SKU, cost, selling price, unit, status, optional
image, optional expiry tracking. Catalog is organization-wide; quantity lives on
branch stock.

# Category

Admin-managed grouping of products. Never hardcoded by industry.

# SKU

Stock keeping unit. Unique **within an organization**.

# Branch stock

On-hand quantity for a product at a branch. Source of truth for undated SKUs and
the sum of lots for dated SKUs.

# Inventory lot

Dated batch (`expiryDate`) used when a product tracks expiry. Sales allocate FEFO.
Expired units are not sellable.

# Inventory history

Immutable record of a quantity change: reason, amount, quantity after, actor,
optional related sale.

# Sale

A completed, immutable transaction. Corrections will use linked returns in a later
slice — never edits.

# Sale item

A line on a sale, snapshotting product name, quantity, unit price, unit cost, and
discount at checkout.

# Receipt

Immutable JSON payload for a completed sale (business identity, lines, totals,
template snapshot). Exactly one receipt per completed sale.

# Held sale

A parked cart. Inventory is not reduced until checkout.

# Customer

Optional organization-wide profile. Sales default to Walk-in. Transactions still
stamp the selling branch.

# Outbox

Local queue of business operations (for example `complete_sale`) waiting to sync
to Convex. Operation-based, not a raw database dump.

# Client operation ID

Idempotency key generated on the device so retries and offline sync do not create
duplicate sales.

# Provisional invoice

Local invoice number (`OFF-…`) printed before Convex assigns the canonical
`INV-…` number.

# Settings

Per-organization key/value configuration (business profile, receipt template).
