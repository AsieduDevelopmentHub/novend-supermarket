# Billing, Plans & Activation

Version: 1.2.0

Novend is sold as a subscription with a lifetime licence option. This document is
the reference for how entitlements are defined, enforced and paid for.

# Decision

The **plan catalog lives in code**, not in the database.

`convex/shared/plans.ts` is the single source of truth for prices, limits and
features. The `plans` table mirrors it and stores only what the code cannot know:
the payment-gateway plan codes. A limit is therefore never editable by a support
mistake, and the same catalog is imported by Convex, the app and the tests.

Convex is authoritative for entitlements. The client caches the last confirmed
licence so a terminal keeps selling offline, but it never decides access.

# Modules

| File | Owns |
|---|---|
| `convex/shared/plans.ts` | Plan catalog, prices, limits, cycle rules, limit messages |
| `convex/shared/licensing.ts` | Pure access rules: `deriveAccess`, grace, usage levels, offline TTL |
| `convex/shared/entitlements.ts` | Database-backed licence resolution, usage counting, capacity checks |
| `convex/shared/subscriptions.ts` | Activation, trials, plan-catalog sync |
| `convex/shared/billingPeriod.ts` | Period arithmetic for monthly/yearly cycles |
| `convex/shared/provisionOrganization.ts` | Tenant bootstrap (trial or assigned plan) |
| `convex/shared/paystack.ts` | Paystack REST client and webhook signature verification |
| `convex/shared/billingProvider.ts` | Gateway abstraction (`manual`, `paystack`) |
| `convex/billing.ts` | Tenant queries, checkout, webhook handlers, platform administration, Enterprise backup quota |
| `convex/billingHttp.ts` | `POST /billing/paystack/webhook` |
| `convex/devices.ts` | Device activation and deactivation |
| `convex/cloudBackups.ts` | Cloud backup uploads against the storage quota |
| `convex/crons.ts` | Daily expiry and catalog maintenance |

# Plans

| Plan | Monthly | Yearly | Products | Users | Branches | Devices | Cloud backup |
|---|---|---|---|---|---|---|---|
| Basic | GH₵200 | GH₵2,000 | 500 | 3 | 1 | 3 | 250 MB |
| Pro (Most Popular) | GH₵400 | GH₵4,000 | 5,000 | 15 | 5 | 15 | 500 MB |
| Enterprise | From GH₵750 | From GH₵7,500 | ∞ | ∞ | ∞ | ∞ | Custom |
| Lifetime | — | GH₵7,990 one-time | ∞ | ∞ | ∞ | ∞ | 1 GB |

Lifetime sits above every subscription: the one-time price is higher than a year of
Basic, Pro, or Enterprise because it includes every entitlement permanently. The
licence does not expire; **1 year of updates and premium support** are included
with the purchase. Recurring plans are never sold on a lifetime cycle. Enterprise
is self-serve, same checkout as Basic and Pro — published as a starting price.
Enterprise cloud backup is **quoted per organization** (whole GB, or no cap).
The catalog never publishes a fixed Enterprise storage size. A Novend platform
administrator sets `organizations.backupLimitBytes` from the licence panel.

`null` always means unlimited. Add a plan by editing `PLAN_CATALOG` and
`planKeyValidator`, then run the gateway sync.

# Access states

`deriveAccess(organizationStatus, subscription, now)` returns the only access
decision in the system.

| State | Read | Write | Cause |
|---|---|---|---|
| `active` | yes | yes | Paid subscription or lifetime licence |
| `trial` | yes | yes | Trial period, 14 days |
| `grace` | yes | yes | Expired or failed payment, within 7 days |
| `suspended` | yes | no | Platform administrator suspended the business |
| `expired` | yes | no | Grace window closed, or trial ended |
| `disabled` | no | no | Platform administrator disabled the business |

Two rules follow from this table and must not be broken:

1. **A business never loses its data.** Every state except `disabled` keeps full
   read access, so receipts and reports stay available while payment is sorted out.
2. **Selling never stops for a payment problem alone.** A failed charge moves the
   business to `grace`, not to read-only.

# Enforcement

The write gate lives in one place. `requireProfile` detects a mutation context and
calls `assertCanWrite`, so every mutation that resolves a session is gated without
per-mutation code.

The few flows that must survive read-only use
`requireSessionIgnoringLicense` / `requireRoleIgnoringLicense`: billing and
renewal, device management, session heartbeat, and personal appearance settings.
Locking an administrator out of the page where they would pay is a bug.

Resource limits are enforced at the create path with `assertOrganizationCapacity`
(products, users, branches, devices, backup bytes). Reaching a limit blocks only
the new record of that kind; existing records and sales are untouched.

Usage alerts are derived in `buildUsageMetric`: **80% informational**, **95% strong
warning**, **100% full** (create of that resource is refused). Cloud backup at
quota pauses cloud uploads only — local backups and the POS continue.

# Payments

Paystack is the live gateway. New businesses start a 14-day Pro trial from
`/signup` → `/onboarding`, then pay from Settings → Billing.

**Recurring vs one-time.** Basic, Pro and Enterprise checkout pass a Paystack
plan code. Paystack then ignores the initialize `amount` and charges the plan:
the first payment creates a subscription, and Paystack deducts again each month
or year until the customer cancels. Lifetime has no plan code — it is a single
charge and never renews.

Because the plan owns the amount, `startCheckout` updates the Paystack plan to
the current catalog price before opening checkout. `billing:syncGatewayPlansInternal`
does the same for every recurring plan.

Money flows in three steps:

1. `billing.startCheckout` records a `pending` row in `billingHistory` with our
   own reference, then asks Paystack for an authorization URL.
2. The customer pays and Paystack returns them to `/billing/callback`, which calls
   `billing.verifyCheckout`.
3. Paystack also posts to `/billing/paystack/webhook`.

Steps 2 and 3 both end in `applySuccessfulPayment`, which is idempotent on the
reference, so a double delivery cannot double-activate or double-charge history.

Renewal charges carry a gateway-generated reference instead of ours, so
`applyGatewayRenewal` matches them by subscription code, then by customer code.

Webhook signatures are verified with HMAC-SHA512 and a timing-safe comparison.
An unsigned or forged request gets `401` and is never parsed as an event.

# Devices

Each installation stores a random fingerprint in `localStorage` and registers
itself on first sign-in. Registration counts against the plan's device limit; a
refused registration shows a dismissible dialog rather than blocking the app,
because a licensing message must never strand a cashier mid-shift.

Administrators free a slot from Settings → Devices. Platform administrators can
clear every activation with `billing.resetActivation` when hardware is replaced.

# Offline

The licence snapshot is cached in Dexie and re-evaluated locally with
`evaluateCachedLicense`. A cached licence is trusted for 30 days — deliberately
longer than the 7-day grace period, because losing connectivity is not a payment
problem. Past the TTL the device falls back to read-only until it reconnects.

# Scheduled work

`convex/crons.ts` runs `billing.dailyMaintenance` once a day: sync the plan
catalog, push catalog prices onto Paystack recurring plans, expire subscriptions
whose grace window closed, and expire finished trials.

# Deployment

Set on the Convex deployment (not just `.env.local`):

| Variable | Purpose |
|---|---|
| `PAYSTACK_SECRET_KEY` | Server-side Paystack calls and webhook verification |
| `NOVEND_SITE_URL` | Absolute base URL used to build the checkout callback |

Then create the recurring plans in Paystack once per deployment:

```bash
npx convex run billing:syncGatewayPlansInternal
```

Finally, point the Paystack dashboard webhook at
`https://<deployment>.convex.site/billing/paystack/webhook` and verify it with:

```bash
pnpm smoke:paystack
pnpm smoke:webhook
```

Without `PAYSTACK_SECRET_KEY` the provider falls back to `manual`: the UI hides
self-service checkout and plans are assigned by a platform administrator.
