# Customers Credit Workflow

Version: 1.0.0

Sell on account to known customers, track what they owe, and record payments.
Requires the **Customer credit** capability (`customer_credit`, Pro and above).
Price lists use a separate capability, **Customer price lists**
(`customer_pricing`, Pro and above). Both are part of the wholesale industry pack.

## Rules

- A balance is the sum of the customer's ledger entries. Positive means the
  customer owes the business.
- `customerLedgerEntries` is append-only. Types: `sale_charge` (+),
  `payment` (−), `adjustment` (signed).
- **On account** is a checkout tender, alone or inside a split payment. It needs
  a named customer (never Walk-in) and the capability. Without them checkout is
  refused by Convex, not just hidden in the UI.
- Each customer has an optional `creditLimit`. Empty means no limit. `0` means
  no credit. A charge that would take the balance above the limit is rejected
  with "Credit limit exceeded".
- Only managers and administrators set credit limits, view the full ledger and
  aging, and record payments. Cashiers see balance, limit and available credit
  for the selected customer at checkout.
- A payment cannot exceed the current balance. Overpayments are not stored as
  negative balances in this slice.
- A return on a sale that was partly or wholly on account writes an
  `adjustment` that reduces the balance by the on-account share of the refund,
  never more than was charged and never more than once for the same units.
- Completed sales stay immutable. Credit corrections are payments or
  adjustments, never edits.
- Every ledger entry records the actor, time and the related sale or payment.

## Split payments

A sale can be paid with several tenders (cash, card, mobile money, on account).
The lines must add up exactly to the sale total. Convex normalizes them
(`normalizeSalePayments`): duplicate methods are merged, zero lines are dropped,
and the largest tender becomes the sale's primary `paymentMethod`. Cash,
card and mobile money are the shortcut pills on the till; **Split payment**
opens one line per tender with a **Rest** button that fills the remainder.
Receipts list every tender. Reports count each tender separately, with
**On account** shown as outstanding rather than collected.

## Aging

Open charges are aged first-in-first-out: payments clear the oldest charges
first. Buckets are 0–30, 31–60 and 61+ days. Managers see aging per customer
and across the organization.

## Price lists

When `customer_pricing` is on, managers define **customer groups** and
**price rules** (per product or category, optional group, minimum quantity in
base units, unit price per base unit, priority). The best matching rule wins:
priority, then product over category, then group-specific over generic, then
the larger quantity tier. Weight-priced lines are never repriced. The server
reprices online sales; offline sales are priced on the till from the mirrored
rules and uploaded as sold snapshots.

## Offline

- The mirror holds `creditLimit`, `customerGroupId`, a balance and the recent
  ledger. Price groups and rules are mirrored and in the snapshot.
- An offline on-account sale checks the limit against the mirrored balance plus
  queued charges, then raises the local balance. Pending and syncing outbox rows
  are overlaid on each snapshot so nothing is counted twice.
- Offline payments queue as `record_customer_payment` and lower the local
  balance immediately.
- If Convex rejects an uploaded sale (limit exceeded because another till
  charged first, credit disabled, customer missing) the optimistic charge is
  rolled back and Sync Center shows "Credit limit exceeded" or the matching
  headline as a permanent business conflict.
- Returns that refund to credit are online-authoritative: the server writes the
  ledger adjustment and the till's balance refreshes on the next sync.

## Related

[`SALES_WORKFLOW.md`](./SALES_WORKFLOW.md),
[`../architecture/OFFLINE_SYNC.md`](../architecture/OFFLINE_SYNC.md),
[`../architecture/DATABASE_SCHEMA.md`](../architecture/DATABASE_SCHEMA.md).
