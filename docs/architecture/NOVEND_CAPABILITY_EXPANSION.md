# Novend Configurable Business Architecture

Version: 2.0.0

**Companion:** [ROADMAP_CAPABILITIES.md](./ROADMAP_CAPABILITIES.md) — phased, flag-gated delivery slices.

This document is the **principles and target model**. It does not prescribe a mega-rollout or a single architecture PR. Implementation order, branch rules, and releasable slices live in the roadmap.

---

## Purpose

Evolve Novend POS from a general retail/wholesale POS into a configurable business operations platform that supports many business types **without** industry forks or separate applications.

Target business types include retail, wholesale distribution, supermarket, cold store, butcher/fish, pharmacy (inventory-oriented), electronics, fashion, convenience, and—later as specialized domains—restaurant and hospitality.

The objective is **not** to rewrite Novend.

> **One stable commerce and operations kernel + configurable capabilities + industry packs + specialized vertical modules where workflows fundamentally differ.**

Existing organizations must keep today’s behavior unless a capability is explicitly enabled (and entitled by plan where applicable).

---

## 1. Non-negotiable principles

### 1.1 Offline-first remains fundamental

Operational flow:

```text
User action → local validation → Dexie transaction → UI update
  → outbox operation → background sync → Convex validation / persistence
```

The UI must not require Convex online before a cashier can perform supported operations. Convex remains the authoritative cloud source of truth. New capabilities must work offline (Electron, Cap, PWA after cache) the same way existing sales do. See [OFFLINE_SYNC.md](./OFFLINE_SYNC.md).

### 1.2 Existing production behavior is the default

Introduce architecture with:

- additive tables and optional fields
- capability flags (default **off**)
- versioned configuration (`configurationVersion`)
- compatibility adapters
- non-destructive migrations

Do not delete or redefine `products.unit`, `sellingPrice`, or stock quantities in place. Map legacy records into the new model; remove legacy fields only in a dedicated later migration after all consumers are migrated.

### 1.3 No industry forks

Never create `novend-retail`, `novend-restaurant`, separate Convex deployments per vertical, or duplicate sales/inventory engines.

Compose behavior from:

```text
Industry profile (preset)
  + Capabilities
  + Capability settings
  + Layout / receipt / import presets
  + Specialized domain modules (when needed)
```

Functional code checks `hasCapability("…")` (or equivalent), not `industryProfile === "restaurant"`, except for onboarding/pack presentation.

### 1.4 Tenancy, integrity, and attribution

Organization isolation is absolute ([MULTI_TENANT.md](./MULTI_TENANT.md)). Inventory cannot go negative without an explicit reconciliation path. Completed sales and receipts remain immutable. Important actions stay attributable to user, time, and operation.

### 1.5 Capabilities vs plan entitlements

Org capability flags must not bypass billing limits. Plan catalog and enforcement live in [BILLING.md](./BILLING.md), `convex/shared/plans.ts`, and `convex/shared/entitlements.ts`. Enabling a capability in settings still requires the org’s plan to allow it.

---

## 2. Current Novend anchors

Implementers must extend these surfaces—not invent a parallel stack.

| Concern                         | Anchor                                                                                                                                                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema overview                 | [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) — `organizations`, `products`, `branchStock`, `inventoryHistory`, `inventoryLots`, `sales` / `saleItems`, `receipts`, `plans`                                                                                                      |
| Schema source                   | [`convex/schema.ts`](../../convex/schema.ts) — `products.unit`, `sellingPrice`, `stockQuantity`; `saleItems` quantity / unit price snapshots                                                                                                                                  |
| Offline / outbox                | [OFFLINE_SYNC.md](./OFFLINE_SYNC.md), [`lib/offline/outbox.ts`](../../lib/offline/outbox.ts), [`lib/offline/outbox-policy.ts`](../../lib/offline/outbox-policy.ts), [`lib/offline/sync-engine.ts`](../../lib/offline/sync-engine.ts) — e.g. `complete_sale`, `upsert_product` |
| Business capabilities (Stage 1) | Settings key `business.capabilities`; registry [`convex/shared/businessCapabilities.ts`](../../convex/shared/businessCapabilities.ts); Dexie `META_KEYS.businessCapabilities`                                                                                                 |
| Inventory history               | `inventoryHistory` (quantity change + reason); lots / FEFO via `inventoryLots`                                                                                                                                                                                                |
| Business vocabulary             | [BUSINESS_GLOSSARY.md](../BUSINESS_GLOSSARY.md)                                                                                                                                                                                                                               |
| Receipts / print mode           | `receipts` table; [`convex/settings.ts`](../../convex/settings.ts) `receiptPrintMode`; [`lib/receipt-print-mode.ts`](../../lib/receipt-print-mode.ts); designer UI under `features/settings`                                                                                  |
| Billing / entitlements          | [BILLING.md](./BILLING.md), [`convex/shared/plans.ts`](../../convex/shared/plans.ts), [`convex/shared/entitlements.ts`](../../convex/shared/entitlements.ts)                                                                                                                  |
| Tenancy                         | [MULTI_TENANT.md](./MULTI_TENANT.md)                                                                                                                                                                                                                                          |
| Hardware / Cap                  | [HARDWARE.md](./HARDWARE.md), [CAPACITOR_MOBILE.md](./CAPACITOR_MOBILE.md)                                                                                                                                                                                                    |
| Money rounding                  | [`lib/currency.ts`](../../lib/currency.ts) `roundMoney` — quantities/money remain **numbers** unless a later migration documents otherwise                                                                                                                                    |

**Sync rule:** conceptual “domain events” in the target model map to **extensions of existing outbox operation types**, not a second sync protocol.

**Naming:** existing **warehouse wholesale** (supplier purchases / wholesale stock) is not the same as POS **pack / multi-unit pricing** (`multi_unit_pricing`). Do not collapse those domains.

---

## 3. Target architecture

```text
NOVEND PLATFORM
│
├── CORE PLATFORM
│   Organizations · Branches · Users · RBAC · Customers
│   Settings · Audit · Electron · Cap/PWA · Hardware
│
├── COMMERCE KERNEL
│   Sales · Sale items (snapshots) · Payments · Returns
│   Discounts · Taxes · Pricing resolution
│
├── INVENTORY KERNEL
│   Catalog · Base units · Sell units · branchStock
│   inventoryHistory · Lots · Transfers · Purchases · Suppliers
│
├── CAPABILITY ENGINE
│   multi_unit_pricing · sell_by_weight · lot_expiry
│   serial_tracking · custom_fields · configurable_pos
│   scale_hardware · non_stock_sales
│   (deferred keys — see roadmap Phase B/C)
│
├── INDUSTRY PACKS (presets)
│   Retail · Wholesale · Supermarket · Cold store
│   Electronics · Pharmacy-inventory · Restaurant · Hotel · Custom
│
└── INFRASTRUCTURE
    Dexie · Outbox / sync engine · Convex
    Conflict reconciliation · Observability
```

Specialized domains (full restaurant orders, hotel folios, regulated Rx) sit **beside** the commerce kernel and settle into shared payments / inventory / ledger—they do not overload `products` or `sales` beyond recognition. Restaurant/hotel **lite** uses `non_stock_sales` + catalogue products (menu items / room rates) without those domain modules.

---

## 4. Capability engine (conceptual)

### Organization configuration

```ts
type IndustryProfile =
  | "retail"
  | "wholesale"
  | "supermarket"
  | "cold_store"
  | "electronics"
  | "pharmacy"
  | "restaurant"
  | "hotel"
  | "custom";
// Full hospitality PMS / restaurant floor modules remain Phase B/C on the roadmap

interface OrganizationBusinessConfiguration {
  industryProfile: IndustryProfile;
  enabledCapabilities: CapabilityKey[];
  capabilitySettings: Record<string, unknown>; // schema-validated per key
  configurationVersion: number;
}
```

Do not pass unvalidated blobs into business logic. Each capability’s settings need a Convex/Zod (or equivalent) schema.

### Capability registry

```ts
type CapabilityKey =
  | "multi_unit_pricing"
  | "sell_by_weight"
  | "lot_expiry"
  | "serial_tracking"
  | "scale_hardware"
  | "custom_fields"
  | "configurable_pos";
// Deferred (Phase B/C — not part of the core rollout):
// modifiers | tables_orders | kitchen_tickets | reservations
// rooms_folio | rx_controls

interface CapabilityDefinition {
  key: CapabilityKey;
  version: number;
  dependencies?: CapabilityKey[];
  conflicts?: CapabilityKey[];
  defaultSettings?: unknown;
  permissions?: string[];
}
```

Capability enabled ≠ permission granted. RBAC remains separate; backend must enforce both capability and permission, plus plan entitlement.

### Industry packs

Packs are **presets** of capability keys + default settings (e.g. cold store → `sell_by_weight`, `lot_expiry`, `scale_hardware`, `configurable_pos`). Orgs may customize after onboarding. Never hardcode restaurant behavior into pack presentation alone.

---

## 5. Unit-of-measure and inventory (target model)

Inventory stops assuming “whole pieces only” once capabilities are on.

- **Base unit** — canonical stock dimension (each, gram, ml, …).
- **Sell units** — cashier-facing units with `factorToBase`, optional barcode and price.
- All sales, returns, transfers, adjustments, and sync validation convert to **base quantity** before mutating `branchStock` / lots.
- Decimal-safe conversion is required for mass/volume (Stage 2+ in the roadmap). Prefer extending existing number + `roundMoney` / quantity rounding conventions over inventing string money.

Example: crate × 24 bottles → deduct `48` base bottles for 2 crates—not `2`.

---

## 6. Compatibility adapters

Until an org is on the new model **and** the relevant capability is on:

| Condition                                         | Canonical source                                                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `configurationVersion < 2` **or** capability off  | `products.unit`, `sellingPrice`, existing quantity fields                                                                                                          |
| Capability on **and** `configurationVersion >= 2` | Product unit configuration + pricing resolution; adapters still **synthesize** a default sell unit (`factorToBase = 1`) from legacy fields for unmigrated products |

Rules:

1. Do not reinterpret legacy fields mid-flight.
2. Dual-read through adapters until every consumer (POS, import, reports, offline) is migrated.
3. Sale lines already snapshot commercial state; extend snapshots (sell unit, base qty, pricing mode) without rewriting historical rows.
4. **N = 2** (`UOM_CONFIGURATION_VERSION` in `convex/shared/units.ts`).

---

## 7. Sale-line snapshots (target)

Completed sale lines must preserve commercial state at sale time: product identity/name, sell unit label, displayed qty, base qty, factor, unit price, totals, pricing mode, optional lot/serial metadata.

Changing the catalog later must not recalculate historical receipts, revenue, COGS, tax, or return eligibility. Align with existing `saleItems` / `receipts` immutability ([DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)).

---

## 8. Pricing (target scope)

Centralize price resolution for POS, returns, receipts, reports, offline, and Convex validation.

**In-scope for the core rollout:** fixed sell-unit price and per-weight price (see roadmap Stage 3).

**Deferred:** tiered quantity, customer-group, branch-specific, and open price (Stage 3b). Do not build a full pricing platform before multi-unit and weight work.

---

## 9. Multi-terminal conflict principles

| Mode                         | Guidance                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Piece / whole base qty       | Keep existing outbox + Convex validation / reject / reconcile patterns ([OFFLINE_SYNC.md](./OFFLINE_SYNC.md)).                                                                                                                                                                                                         |
| Fractional base qty (weight) | Harder: two offline terminals can oversell the same SKU. Prefer explicit reconciliation (immutable completed sales + manager-visible conflict / adjustment)—never rewrite completed sales or silently drop an outbox sale. Detail matrix: [ROADMAP_CAPABILITIES.md](./ROADMAP_CAPABILITIES.md) (sell-by-weight slice). |

Always: no cross-org leakage; attributable movements via `inventoryHistory` (extend reasons—do not invent a parallel ledger for core stages).

---

## 10. Cross-cutting: Cap, Electron, hardware

- Capability and unit configuration required for selling must be **cached in Dexie** (never online-only config).
- Scale integration is optional behind `scale_hardware`; weighted sales must work with manual weight entry first.
- Receipt / POS presets must respect Cap and Electron shells ([CAPACITOR_MOBILE.md](./CAPACITOR_MOBILE.md), [HARDWARE.md](./HARDWARE.md)).

---

## 11. Customization (target)

Prefer structured configuration over free-form builders:

- Receipt template sections conditional on capabilities
- Import column maps / industry import presets
- POS **layout presets** (grid+cart, weight keypad, pack picker)—not a low-code page builder
- Schema-controlled custom fields (text, number, date, select, …), org-scoped, offline-cached

---

## 12. Deferred domains (not this core model’s delivery)

Documented for orientation only; design and ship under roadmap **Phase B / C**:

| Domain        | Why separate                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| Restaurant    | Tables, modifiers, kitchen tickets, recipes ≠ retail `sales`                                                |
| Hospitality   | Rooms, stays, folios ≠ SKU products                                                                         |
| `rx_controls` | Regulated; no compliance design yet. Pharmacy **lots / expiry / custom fields** may ship earlier without Rx |

---

## 13. Quality rules

Prefer: central domain services, small modules, explicit capability checks, strong typing, idempotent outbox ops, immutable snapshots, deterministic conversion.

Avoid: industry forks, scattered pack/weight math, UI→Convex for every paint, duplicate stock mutation paths, unversioned configuration, free-form executable templates.

---

## 14. Final architectural goal

Novend should be understood as:

> **A configurable offline-first business operations platform on a shared commerce, inventory, financial, sync, hardware, and security kernel. Organizations enable capabilities and industry presets; specialized domains extend the platform where workflows fundamentally differ.**

Delivery of that goal is **incremental and flag-gated**. See [ROADMAP_CAPABILITIES.md](./ROADMAP_CAPABILITIES.md).
