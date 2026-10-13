# Industry production-readiness audit (gpt.md)

Date: 2026-10-13  
Source: [`docs/gpt.md`](./gpt.md)  
Pharmacy note: additive schema only — existing pharmacy orgs keep `lot_expiry` / `custom_fields`; no destructive migrations.

## Pack status

| Industry | Pack keys | Production notes |
| -------- | --------- | ---------------- |
| retail | configurable_pos | Lean POS |
| wholesale | multi_unit, customer_pricing, customer_credit, configurable_pos | Warehouse + till packs/credit (Pro+) |
| supermarket | multi_unit, lot_expiry, sell_by_weight, configurable_pos | Weight added to pack |
| convenience | multi_unit, lot_expiry, configurable_pos | **New** |
| cold_store | sell_by_weight, lot_expiry, scale_hardware, configurable_pos | Scale hardware still deferred (manual weight works) |
| electronics | serial_tracking, configurable_pos | Serial capture at sale **shipped** |
| pharmacy | lot_expiry, custom_fields, configurable_pos | Custom fields **shipped**; no `rx_controls` |
| fashion | product_variants, configurable_pos | **New** — parent/child variants |
| cosmetics | product_variants, lot_expiry, custom_fields, configurable_pos | **New** |
| hardware | multi_unit, serial_tracking, configurable_pos | **New** |
| stationery | multi_unit, product_variants, configurable_pos | **New** |
| restaurant / bar / hotel | dining / rooms packs | Unchanged hospitality MVP |

## Variant model

Parents (`isVariantParent`) are catalog-only. Children use `parentProductId` + `variantAttributes` and keep normal `branchStock` / sales / returns. Capability: `product_variants` (Pro+).

## Still deferred / external

- Live scale hardware adapter
- Regulated pharmacy `rx_controls`
- Full configurable_pos layout presets
- Live two-org IDOR on staging, desktop signing, legal (see production checklist)

## Regression

Pharmacy pack still includes `lot_expiry` + `custom_fields`. Capability-off orgs unchanged.
