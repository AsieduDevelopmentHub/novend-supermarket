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

| Term | Meaning in Novend |
| ---- | ----------------- |
| Warehouse wholesale | Existing supplier purchases / wholesale stock / issue-to-branch |
| `multi_unit_pricing` | POS sell units (pack, carton) with `factorToBase` into base inventory |

Do not rewrite warehouse wholesale when implementing pack pricing.

---

## Stage 1 — Foundation (`capability` platform) — **implemented**

**Primary deliverable:** industry profile + capability registry (not a single sell-mode key).

| Item | Notes |
| ---- | ----- |
| Org business configuration | Settings key `business.capabilities` — `industryProfile`, `enabledCapabilities`, `capabilitySettings`, `configurationVersion` |
| Capability registry | [`convex/shared/businessCapabilities.ts`](../../convex/shared/businessCapabilities.ts) |
| Nav / RBAC gates | `NavItem.capabilities` + `navGroupsForRole(role, enabled)`; Convex `requireBusinessCapability` |
| Plan hook | `planAllowsBusinessCapability` / validate on update — Pro+ for pack/weight/serial/scale |
| Dexie | `META_KEYS.businessCapabilities` via offline snapshot |
| Admin UI | Settings → Business → Business type & capabilities |

**Default:** all capabilities off; behavior = today’s Novend.

**Exit:** Orgs can store a pack preset; UI/nav can gate on `hasCapability`; no pricing/UOM behavior yet.

---

## Stage 2 — Catalog foundation (UOM + snapshots)

Treat as one releasable theme; may be one or two PRs if needed, but **sale-line snapshot fields ship with UOM**—do not ship multi-unit UI before historical integrity.

| Item | Notes |
| ---- | ----- |
| Units of measure | Base unit + product sell units |
| Conversion service | Base qty; decimal-safe for mass/volume; numbers + existing rounding (`roundMoney` / qty helpers) |
| Compatibility adapter | Legacy `unit` + `sellingPrice` canonical until `configurationVersion >= N` and capability on; synthesize `factorToBase = 1` |
| Sale-line snapshots | Extend `saleItems` (and receipt payload) with sell unit, base qty, factor, pricing mode |
| Migration | Existing products behave as single sell unit without manual reconfigure |

**Define `N`** in the Stage 2 PR and update the expansion doc adapter section.

**Exit:** Capability-off orgs unchanged; adapter path tested for dual-read.

---

## Stage 3 — Pricing (narrowed)

Central resolve used by POS, returns, receipts, reports, offline, Convex.

### 3a — `multi_unit_pricing` (one branch)

- Fixed price per sell unit (bottle / pack / crate)
- Optional per-unit barcodes
- Inventory always deducts base qty
- POS unit selector when capability on

### 3b — `sell_by_weight` (separate branch)

- Per-weight price; manual weight first
- `scale_hardware` later (dependency optional)
- Weight-aware receipts and returns
- Conflict matrix below is **mandatory** for this slice

### Deferred (Stage 3c — later)

Tiered quantity, customer-group, branch-specific, and open price. Document extension points only; do not implement in 3a/3b.

---

## Weight / fractional stock — conflict matrix

Applies when `sell_by_weight` (or any fractional base qty) is enabled. Harder than whole-piece stock.

| Scenario | Required behavior |
| -------- | ----------------- |
| Terminal A and B both offline; both sell from same SKU/branch | Each completes a local sale (immutable). Sync must not drop either sale silently. |
| Combined base qty exceeds on-hand after both sync | Convex rejects or accepts with **explicit reconciliation** (e.g. negative prevented + conflict record / manager adjustment)—product choice must be documented in the PR. Completed sales and receipts are **never** rewritten. |
| Retry / idempotency | Same outbox id must not double-apply stock. |
| Piece-only orgs (capability off) | Unchanged vs today’s outbox + validation. |
| Restart mid-offline | Sale remains in Dexie + outbox; reconnect flushes once. |

Do not ship `sell_by_weight` without automated or scripted multi-terminal conflict coverage for this matrix.

---

## Stage 4 — Inventory strengthen

| Item | Notes |
| ---- | ----- |
| Ledger | **Extend** `inventoryHistory` reasons/fields—do not create a parallel movement table for this stage |
| `lot_expiry` | Strengthen existing `inventoryLots` / FEFO; capability-gate FEFO where appropriate |
| `serial_tracking` | Separate branch; electronics-oriented; unique serial sell-once |

Pharmacy **lots / expiry / custom field types** may appear here or in Stage 5 **without** `rx_controls`.

---

## Stage 5 — Customization

| Item | Notes |
| ---- | ----- |
| `custom_fields` | Schema-controlled, org-scoped, Dexie-cached, synced |
| Import templates | One pipeline; industry column presets ([IMPORT_EXPORT.md](./IMPORT_EXPORT.md)) |
| Receipt templates | Conditional sections (weight, unit, batch, serial) |
| `configurable_pos` | Presets only (grid+cart, weight keypad, pack picker)—no page builder |

---

## Phase B — Restaurant domain (deferred)

Separate product effort after Stages 1–5 prove the kernel.

Entities such as: restaurant order, table session, modifiers, kitchen ticket, recipe consumption → inventory via `inventoryHistory`.

Capabilities (when designed): `modifiers`, `tables_orders`, `kitchen_tickets`.

**Do not** implement on the same branch as UOM or pack pricing.

---

## Phase C — Hospitality and regulated pharmacy (deferred)

| Area | Notes |
| ---- | ----- |
| Hospitality | Rooms, guests, reservations, stays, folios—not ordinary products. Capability: `rooms_folio` (and related) when designed. |
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
—  Phase B restaurant
—  Phase C hospitality / rx_controls
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
