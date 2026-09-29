# Hospitality Operations (Restaurant, Bar, Hotel)

Version: 1.0.0  
Source brief: `docs/gpt.md` (Phases A–D on `feat/hospitality-ops-gpt`)

## Purpose

Make Restaurant, Bar, and Hotel profiles behave as connected operational
workflows — not retail POS pages with extra routes bolted on — while keeping
the existing Dexie outbox + Convex authority offline model.

Retail, Pharmacy, Supermarket, and Wholesale behaviour is preserved.

## Root causes addressed

| Finding | Cause | Fix |
| --- | --- | --- |
| Held sales buried under catalogue | Held list rendered below product grid | `HeldSalesPanel` beside **Current Sale**; badge + sheet/panel |
| Generic Floor / Kitchen for Bar | Hardcoded retail/restaurant copy | Central `businessTerms` by industry + overrides |
| Open checks/folios invisible in Orders | Orders listed completed sales only | `operations.listOpenOperations` + Orders **Open** tab |
| Hotel dashboard retail-shaped | Dashboard ignored hotel/dining ops | `dashboard` hospitality summary cards (capability-gated) |
| Overlapping room assignments | Weak / missing conflict checks | Shared `hotelReservations` helpers; server + offline enforce |
| Selectors without search | Plain `Select` for large entity lists | `SearchableSelect` on hospitality product/guest/room/branch pickers |
| Non-stock shown as “In stock” | Catalogue status conflated with inventory | `tracksInventory` drives Availability vs Catalogue columns |
| Ops pages blank offline | Floors/rooms/reservations not mirrored | Dexie v11–v13 hospitality stores + snapshot + outbox actions |
| Pack apply mutates nav / branding early | Industry pack wrote live config immediately | Draft-only until Save; brand colours never reset by pack |

## Schema and offline changes

### Convex (no second ops DB)

- **`convex/operations.ts`** — `listOpenOperations` aggregates open dining
  sessions, open hotel stays (folios), and near-term active reservations.
  Source types: `restaurant_table` | `bar_tab` | `room_folio` | `reservation`.
- **`convex/shared/businessTerms.ts`** — industry default maps + override merge;
  UI helpers for sales/floor/dashboard copy.
- **`convex/shared/hotelReservations.ts`** — pure conflict math
  (half-open `[arrival, departure)`), blocking statuses, available-room hints.
- **`convex/hotel.ts` / `convex/dining.ts`** — conflict rechecks and ops fields
  used by UI / sync.
- **`convex/dashboard.ts`** — hotel room counts, arrivals/departures, folio
  balances; dining occupied tables and kitchen ticket counts.
- **`convex/settings.ts` / `convex/offline.ts`** — terminology settings +
  hospitality rows in pull snapshot.
- **`convex/_generated/api.d.ts`** — includes `operations`,
  `shared/businessTerms`, `shared/hotelReservations` (kept for build; do not
  re-run codegen unless modules change).

### Dexie / sync

- New / extended mirror tables: dining tables & sessions & items, kitchen
  tickets, hotel rooms, stays, folio charges, reservations.
- Snapshot replace preserves pending local IDs; outbox ops for open check, add
  item, fire ticket, pay session, reserve, check-in, folio charge, checkout.
- Conflict handling on reservation sync reuses the same pure helpers as the
  server.
- Business terminology cached with the licence / settings snapshot for offline
  nav and labels (`lib/offline/business-terms.ts`).

## Screens and components

| Area | Change |
| --- | --- |
| Sales | Held sales trigger + panel; industry-aware sale description |
| Orders | Tabs: All activity / Open operations / Completed; origin labels |
| Dining floor / kitchen | Offline-first lists; searchable product/branch; term-driven titles |
| Hotel rooms / reservations | Offline actions; searchable guest/product/room; conflict messages |
| Dashboard | Hotel + dining ops cards when capabilities enabled |
| Products | Non-stock / catalogue vs availability; expiry scoped to `tracksExpiry` |
| Settings → Selling options | Pack preview draft; Save applies; branding preserved |
| Nav (sidebar, mobile, More) | Labels from `useBusinessTerms` |

Key modules: `features/sales/components/held-sales-panel.tsx`,
`features/orders/open-operations.ts`, `lib/offline/hospitality-actions.ts`,
`hooks/use-business-terms.ts`, `components/ui/searchable-select.tsx`.

## Tests

| File | Coverage |
| --- | --- |
| `tests/hospitality-ops-phase-a.test.ts` | Held sales placement; non-stock UI; SearchableSelect contracts |
| `tests/orders-open-operations.test.ts` | Sources, tabs, filters, origin/fulfilment labels |
| `tests/hotel-reservation-conflicts.test.ts` | Overlap, blocking statuses, occupied rooms, suggestions |
| `tests/business-capabilities.test.ts` | Terminology defaults / overrides |
| `tests/experience-industry-presets.test.ts` | Pack / experience contracts |
| `tests/navigation.test.ts` / `redirect-after-login.test.ts` | Regression |

## Limitations (deferred)

Not completed in Phases A–D; track for follow-up:

1. **App-wide SearchableSelect migration** — hospitality and key hotel/dining
   pickers only; suppliers/categories/wholesale selectors and full
   virtualisation / remote debounce remain.
2. **Occupied-room override + audit** — hard reject is enforced; explicit
   override permission with audit trail is not shipped.
3. **Split checks / multi-check tables** — still one active check per table.
4. **Terminology on receipts & reports** — nav, headings, and primary ops copy
   use terms; every receipt/report string is not fully migrated.
5. **Role-specific hospitality shells** — owners see dashboard ops; dedicated
   server/kitchen/front-desk layouts beyond existing permissions are not new.
6. **E2E / device sync matrix** — unit and contract tests cover models; browser
   E2E for hold badge sync and multi-device reservation race are deferred.
7. **POS source in Open Operations** — open held sales remain on Sales; Open
   Operations lists hospitality ops, not held POS carts.
8. **Warning when disabling features with live ops** — draft Save preserves
   records; a dedicated “active checks/folios exist” disable warning UI is
   incomplete.

## Integration notes

- Extend existing outbox types and sync-engine handlers; do not add a second
  offline architecture.
- Prefer `resolveBusinessTerms` / `useBusinessTerms` over new hardcoded
  industry conditionals in UI.
- Keep Convex as the authority for payment, inventory deduction, and final
  sale linkage on check/folio settle.
