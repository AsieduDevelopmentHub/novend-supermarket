# Capabilities roadmap

Version: 1.0.0

**Principles & target model:** [NOVEND_CAPABILITY_EXPANSION.md](./NOVEND_CAPABILITY_EXPANSION.md)

This roadmap defines **phased, independently releasable slices**. Each slice merges to `main` behind capability flags (default **off**). There is no “finish all stages then one architecture PR.”

---

## Delivery rules

1. **Flag-gated releases** — Ship thin vertical slices via normal `staging` → `main` → `v*` Product Release. Existing orgs must regress identically with capabilities off.
2. **One primary `CapabilityKey` per feature branch** — Fixes/docs for that key are allowed. Do not stack restaurant/hospitality work on a UOM branch. Do not combine unrelated capability keys in one PR.
3. **Extend existing anchors** — Outbox ops, `inventoryHistory`, `saleItems`, Dexie mirror, plan entitlements. No parallel sync protocol or second inventory ledger for Stages 1–5.
4. **Definition of Done (every slice)** — Additive schema as needed · Dexie cache · outbox shape · Convex authz/validation · RBAC/UI as needed · capability-off regression · online/offline/reconnect tests as applicable · docs in the same change.
5. **Branch naming** — `feat/<capability-or-slice>` from latest `staging` (e.g. `feat/capability-engine`, `feat/multi-unit-pricing`, `feat/sell-by-weight`).

```text
staging → feature branch (one capability)
  → validate (lint, typecheck, test, build, offline regression)
  → merge to staging
  → release PR to main when ready
  → tag v* as usual
```

---

## Naming: wholesale vs pack pricing

| Term                 | Meaning in Novend                                                     |
| -------------------- | --------------------------------------------------------------------- |
| Warehouse wholesale  | Existing supplier purchases / wholesale stock / issue-to-branch       |
| `multi_unit_pricing` | POS sell units (pack, carton) with `factorToBase` into base inventory |

Do not rewrite warehouse wholesale when implementing pack pricing.

---

## Stage 1 — Foundation (`capability` platform) — **implemented**

**Primary deliverable:** industry profile + capability registry (not a single sell-mode key).

| Item                       | Notes                                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Org business configuration | Settings key `business.capabilities` — `industryProfile`, `enabledCapabilities`, `capabilitySettings`, `configurationVersion` |
| Capability registry        | [`convex/shared/businessCapabilities.ts`](../../convex/shared/businessCapabilities.ts)                                        |
| Nav / RBAC gates           | `NavItem.capabilities` + `navGroupsForRole(role, enabled)`; Convex `requireBusinessCapability`                                |
| Plan hook                  | `planAllowsBusinessCapability` / validate on update — Pro+ for pack/weight/serial/scale                                       |
| Dexie                      | `META_KEYS.businessCapabilities` via offline snapshot                                                                         |
| Admin UI                   | Settings → Business → Business type & capabilities                                                                            |

**Default:** all capabilities off; behavior = today’s Novend.

**Exit:** Orgs can store a pack preset; UI/nav can gate on `hasCapability`; no pricing/UOM behavior yet.

---

## Stage 2 — Catalog foundation (UOM + snapshots) — **implemented**

Treat as one releasable theme; may be one or two PRs if needed, but **sale-line snapshot fields ship with UOM**—do not ship multi-unit UI before historical integrity.

| Item                  | Notes                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Units of measure      | `products.sellUnits` + `pricingMode`; [`convex/shared/units.ts`](../../convex/shared/units.ts)                             |
| Conversion service    | Base qty via `toBaseQuantity` / `buildSaleLineUnitSnapshot`                                                                |
| Compatibility adapter | Legacy `unit` + `sellingPrice` → synthesized default sell unit (`factorToBase = 1`). **N = 2**                             |
| Sale-line snapshots   | `saleItems` optional `sellUnitKey`, `sellUnitLabel`, `displayedQuantity`, `factorToBase`, `pricingMode`; `quantity` = base |
| Migration             | Existing products behave as single sell unit without manual reconfigure                                                    |

**Exit:** Capability-off orgs unchanged; adapter path tested for dual-read.

## Stage 3 — Pricing (narrowed) — **implemented** (scale hardware deferred)

### 3a — `multi_unit_pricing`

- Sell units on product + POS uses configured units when capability on
- Inventory deducts **base** qty online and offline
- Product create/update accept `sellUnits` / `pricingMode`
- Product form UI edits sell units when capability is enabled

### 3b — `sell_by_weight`

- `pricingMode: "per_weight"` allows fractional displayed qty
- Manual weight first (no scale hardware in this slice)
- Conflict matrix product choice documented + automated in `tests/weight-conflict-matrix.test.ts`

### 3c — `customer_pricing` and `customer_credit` — **implemented** (wholesale)

- `customer_pricing`: customer groups and price-list rules (tiered quantity,
  group, per product or category). Pure `resolveUnitPrice` runs in Convex and
  offline.
- `customer_credit`: credit limits, on-account tender, receivable ledger, aging,
  recorded payments. Split payments are core (no capability) and reuse the same
  `salePayments` model. See
  [`../business/CUSTOMERS_CREDIT_WORKFLOW.md`](../business/CUSTOMERS_CREDIT_WORKFLOW.md).

### Deferred (remaining Stage 3c)

Branch-specific and open price are still deferred. (Tiered quantity and
customer-group pricing shipped above.)

`scale_hardware` — optional follow-up after manual weight.

---

## Weight / fractional stock — conflict matrix

Applies when `sell_by_weight` (or any fractional base qty) is enabled. Harder than whole-piece stock.

| Scenario                                                      | Required behavior                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Terminal A and B both offline; both sell from same SKU/branch | Each completes a local sale (immutable). Sync must not drop either sale silently.                                                                                                                                                                                                                                          |
| Combined base qty exceeds on-hand after both sync             | **Product choice (shipped):** Convex **rejects** the later apply (`Not enough stock…`); inventory never goes negative. The local sale, receipt, and outbox row remain; outbox is marked **failed** (definitive conflict) for Sync Center / manager stock adjustment. Completed sales and receipts are **never** rewritten. |
| Retry / idempotency                                           | Same outbox id must not double-apply stock.                                                                                                                                                                                                                                                                                |
| Piece-only orgs (capability off)                              | Unchanged vs today’s outbox + validation.                                                                                                                                                                                                                                                                                  |
| Restart mid-offline                                           | Sale remains in Dexie + outbox; reconnect flushes once.                                                                                                                                                                                                                                                                    |

Automated coverage: `tests/weight-conflict-matrix.test.ts` (oversell → definitive outbox failure). Manual multi-terminal QA still recommended before enabling `sell_by_weight` in production orgs.

`scale_hardware` remains a follow-up (manual weight entry only in this slice). See `docs/architecture/HARDWARE.md`.

---

## Stage 4 — Inventory strengthen

| Item              | Notes                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| Ledger            | **Extend** `inventoryHistory` reasons/fields—do not create a parallel movement table for this stage |
| `lot_expiry`      | Strengthen existing `inventoryLots` / FEFO; capability-gate FEFO where appropriate                  |
| `serial_tracking` | Separate branch; electronics-oriented; unique serial sell-once                                      |

Pharmacy **lots / expiry / custom field types** may appear here or in Stage 5 **without** `rx_controls`.

---

## Stage 5 — Customization

| Item               | Notes                                                                          |
| ------------------ | ------------------------------------------------------------------------------ |
| `custom_fields`    | Schema-controlled, org-scoped, Dexie-cached, synced                            |
| Import templates   | One pipeline; industry column presets ([IMPORT_EXPORT.md](./IMPORT_EXPORT.md)) |
| Receipt templates  | Conditional sections (weight, unit, batch, serial)                             |
| `configurable_pos` | Presets only (grid+cart, weight keypad, pack picker)—no page builder           |

---

## Phase B lite — Non-stock catalogue (`non_stock_sales`) — **implemented**

Thin slice for restaurant / hotel **without** tables, kitchen, or PMS:

| Item | Notes |
| ---- | ----- |
| Capability | `non_stock_sales` (Basic+) — Track inventory toggle on Add Product |
| Product field | `products.tracksInventory` optional; `false` skips stock check/deduct |
| Industry packs | `restaurant`, `hotel` → `non_stock_sales` + `configurable_pos` |
| POS | Catalog includes zero-qty non-stock items online and offline |
| Stock chrome | Presentation only — hide Inventory / Wholesale / Suppliers nav and dashboard low-stock UI when `industryProfile` is `restaurant` or `hotel` (`stockOpsVisibleForIndustry`) |
| Experience presets | Applying a Restaurant pack seeds warm amber branding; Hotel seeds teal + navy. Charts use `--chart-1..5` derived from accent |
| Admin finance | Dashboard “Inventory & profit” cards (admin only, branch filter) — inventory cost/sell value, period revenue / COGS / gross profit |
| Out of scope here | Tables, modifiers, KDS, recipe consumption, reservations, folios |

Full Phase B / C domain modules remain deferred below.

---

## Phase B — Restaurant / bar floor — **implemented (MVP)**

| Item | Notes |
| ---- | ----- |
| Capabilities | `modifiers`, `tables_orders`, `kitchen_tickets` (Basic+; kitchen depends on tables) |
| Profiles | `restaurant` / `bar` packs include lite + Phase B keys; `hotel` stays room-rate lite |
| Onboarding | Owner picks business type; Other/custom → retail; optional policy `defaultIndustryProfile` |
| Domain tables | `diningTables`, `diningSessions`, `diningSessionItems`, `modifierGroups`, `modifierOptions`, `kitchenTickets`, `kitchenTicketLines` |
| Settle | `dining.paySession` → immutable `sales` / `saleItems` / receipts / stock |
| UI | `/floor`, `/kitchen`; product modifier editor when capability on |
| Offline | Dining tables mirrored in Dexie; open/pay outbox ops; floor/kitchen writes require online for MVP |
| Still deferred | Recipe/BOM → inventory, tip pools, guest QR |

## Phase B — Restaurant domain (deferred extensions)

Recipe consumption → `inventoryHistory`, advanced course firing.

Capabilities (when designed): recipe BOM (extends Phase B MVP).

---

## Phase C — Hotel folio MVP (implemented)

| Area | Notes |
| ---- | ----- |
| Capabilities | `rooms_folio`, `reservations` (Basic+; reservations depends on rooms_folio) |
| Hotel pack | `non_stock_sales`, `configurable_pos`, `rooms_folio`, `reservations` |
| Domain tables | `hotelRooms`, `hotelReservations`, `hotelStays`, `hotelFolioCharges` |
| Guests | Existing `customers` (no separate guest CRM) |
| Settle | `hotel.checkoutPay` → immutable `sales` / `saleItems` / receipts / stock |
| UI | `/rooms` board + folio, `/reservations`; org experience tokens (`--primary`) |
| Offline | Rooms mirrored in Dexie; check-in / checkout outbox ops; board writes online-first |
| Still deferred | OTA/channels, deposits, tax splits, dining-on-folio, housekeeping apps |

## Phase C — Regulated pharmacy (deferred)

| Area | Notes |
| ---- | ----- |
| `rx_controls` | Regulated; **out of scope** until a compliance design exists. |

---

## Suggested sequence (summary)

```text
1  Capability engine + packs + nav/RBAC + plan hook
2  UOM + adapters + sale-line snapshots
3a multi_unit_pricing
3b sell_by_weight (+ conflict matrix) · scale_hardware optional follow-up
4  inventoryHistory / lots / serials (separate branches per key)
5  custom_fields · import/receipt presets · configurable_pos
5b non_stock_sales + restaurant/hotel packs (lite)
—  Phase B restaurant (tables / modifiers / kitchen)
—  Phase C hotel folio MVP (rooms / reservations / checkout → sales)
—  Phase C rx_controls (deferred)
```

---

## Regression gate (every merge toward main)

With **no** new capabilities enabled:

Login · Dashboard · Products · Inventory · Sales · Orders · Returns · Customers · Branches · Users · Reports · Settings · Printing · Electron/Cap offline startup · Sync

Must match current Novend behavior.

---

## Related docs

- [NOVEND_CAPABILITY_EXPANSION.md](./NOVEND_CAPABILITY_EXPANSION.md)
- [OFFLINE_SYNC.md](./OFFLINE_SYNC.md)
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- [BILLING.md](./BILLING.md)
- [HARDWARE.md](./HARDWARE.md)
- [CAPACITOR_MOBILE.md](./CAPACITOR_MOBILE.md)
