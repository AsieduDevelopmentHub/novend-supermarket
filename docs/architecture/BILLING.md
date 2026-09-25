# Billing, Plans & Activation

Version: 1.4.0

Novend is sold as a Monthly or Annual subscription. Lifetime remains in the
catalog only for historical licences — it is not offered for new sales.

**Product default:** billing UI defaults to **Monthly**; Annual is the alternate
toggle (labeled “Annual”, internal cycle value stays `yearly`) and shows
“2 months free”. This overrides an earlier Annual-default draft in the
platform entitlements brief.

# Decision

The **plan catalog lives in code**, not in the database.

`convex/shared/plans.ts` is the single source of truth for prices, limits and
features. The `plans` table mirrors it and stores only what the code cannot know:
the payment-gateway plan codes. A limit is therefore never editable by a support
mistake, and the same catalog is imported by Convex, the app and the tests.

`SELLABLE_PLAN_KEYS` (`basic`, `pro`, `enterprise`) drives public pricing and
self-serve checkout. `lifetime` stays resolvable for existing orgs (`legacy: true`,
`selfServe: false`). Unknown plan strings fall back to `DEFAULT_PLAN_KEY` (`basic`).

Convex is authoritative for entitlements. The client caches the last confirmed
licence so a terminal keeps selling offline, but it never decides access.

# Modules

| File                                     | Owns                                                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `convex/shared/capabilities.ts`          | Plan-derived capabilities (`canExportXlsx`, `canManageStaffCompensation`, `canUseCustomerDisplay`, `maxImportRows`, …) |
| `convex/shared/plans.ts`                 | Plan catalog, prices, limits, cycle rules, limit messages                                                              |
| `convex/shared/commercialOffers.ts`      | Private offer validity and price helpers (tenant-safe projections)                                                     |
| `convex/commercialOffers.ts`             | Tenant `myActiveOffer` / `acceptOffer`; offer Paystack plan-code persistence                                           |
| `convex/shared/licensing.ts`             | Pure access rules: `deriveAccess`, grace, usage levels, offline TTL                                                    |
| `convex/shared/entitlements.ts`          | Database-backed licence resolution, usage counting, capacity checks                                                    |
| `convex/shared/subscriptions.ts`         | Activation, trials, plan-catalog sync                                                                                  |
| `convex/shared/billingPeriod.ts`         | Period arithmetic for monthly/yearly cycles                                                                            |
| `convex/shared/planChange.ts`            | Upgrade proration and scheduled-downgrade preview (supports offer price overrides)                                     |
| `convex/shared/provisionOrganization.ts` | Tenant bootstrap (trial or assigned plan)                                                                              |
| `convex/shared/paystack.ts`              | Paystack REST client and webhook signature verification                                                                |
| `convex/shared/billingProvider.ts`       | Gateway abstraction (`manual`, `paystack`)                                                                             |
| `convex/billing.ts`                      | Tenant queries, checkout, webhook handlers, platform administration, Enterprise backup quota                           |
| `convex/billingHttp.ts`                  | `POST /billing/paystack/webhook`                                                                                       |
| `convex/devices.ts`                      | Device activation and deactivation                                                                                     |
| `convex/cloudBackups.ts`                 | Cloud backup uploads against the storage quota. UI: Settings → Backups                                                 |
| `convex/crons.ts`                        | Daily expiry and catalog maintenance                                                                                   |

# Plans

| Plan               | Monthly | Annual (yearly)   | Products | Users | Branches | Devices | Cloud backup | Sellable |
| ------------------ | ------- | ----------------- | -------- | ----- | -------- | ------- | ------------ | -------- |
| Basic              | GH₵200  | GH₵2,000          | 500      | 3     | 1        | 3       | 250 MB       | yes      |
| Pro (Most Popular) | GH₵450  | GH₵4,500          | 5,000    | 15    | 5        | 15      | 500 MB       | yes      |
| Enterprise         | GH₵750+ | GH₵7,500+         | ∞        | ∞     | ∞        | ∞       | Custom       | yes      |
| Lifetime (legacy)  | —       | GH₵7,990 one-time | ∞        | ∞     | ∞        | ∞       | 1 GB         | no       |

Lifetime is retained so existing customers keep access. Platform admins cannot newly
assign Lifetime except when an organization is already on Lifetime (view / keep /
migrate). Recurring plans are never sold on a lifetime cycle. Enterprise is
self-serve — published as **GH₵750+**. Annual recurring prices are **10 × monthly**
(two months free). Enterprise cloud backup is **quoted per organization**.

# Private commercial offers

`commercialOffers` stores negotiated Monthly, Annual, and optional **Lifetime
(one-time)** prices for one organization. Lifetime buyouts keep the offer’s
`basePlanKey` entitlements permanently (`subscriptions.isLifetime` / cycle
`lifetime`). The one-time charge is recorded on `billingHistory` when PEAS
applies with “record a payment” — it contributes to **gross revenue** (and net
after operating costs) and **never** to MRR/ARR.

Tenant APIs derive `organizationId` from the session (`commercialOffers.myActiveOffer`) —
never from client args. Internal notes and Paystack plan codes are never returned
to tenants.

When checkout targets the offer’s `basePlanKey` and a recurring `allowedCycles`
entry (`monthly` / `yearly`), `billing.startCheckout` / `previewPlanChange` use
the offer amounts (via `targetPriceOverride`) and create/update a **dedicated**
Paystack recurring plan stored on the offer row (`gatewayMonthlyPlanCode` /
`gatewayYearlyPlanCode`). Those codes are never written to the public `plans`
catalog. Lifetime commercial is PEAS-applied (manual assign + optional payment
row), not self-serve Paystack recurring.

Subscription `amount` remains the charged/recurring major-unit value after
activation. Paystack webhooks (`billingHttp`) continue to apply payments by
reference / gateway subscription code even when Billing UI is hidden for the org.

**Known gap:** mid-cycle upgrades that keep the current period still charge a
one-time initialize amount (no plan code). Offer-specific recurring alignment after
a prorated upgrade relies on the existing gateway subscription alignment path;
offer codes are ensured on non-prorated recurring checkouts. Platform CRUD UI for
creating offers is a separate phase — schema + tenant query + checkout wiring ship
here.

`null` always means unlimited. Add a plan by editing `PLAN_CATALOG` and
`planKeyValidator`, then run the gateway sync.

Import and export formats are derived in `convex/shared/capabilities.ts` from this
catalog — not from scattered `if (plan === "pro")` checks. CSV/JSON export and
product import are available on every commercial plan. Excel and PDF follow Pro
rank (the same cut as “Advanced analytics” and staff salary/commission). `maxImportRows` is the product
limit, capped at 10,000 per file. A Super Admin product-limit override on an
organization also changes that org’s import row cap; it does not unlock Excel or
PDF. Super Admin org overview, licence, and the organizations list show the
derived cap and recorded import/export activity (counts and filenames only).
See [`IMPORT_EXPORT.md`](./IMPORT_EXPORT.md).

# Access states

`deriveAccess(organizationStatus, subscription, now)` returns the only access
decision in the system.

| State       | Read | Write | Cause                                         |
| ----------- | ---- | ----- | --------------------------------------------- |
| `active`    | yes  | yes   | Paid subscription or lifetime licence         |
| `trial`     | yes  | yes   | Trial period, 14 days                         |
| `grace`     | yes  | yes   | Expired or failed payment, within 7 days      |
| `suspended` | yes  | no    | Platform administrator suspended the business |
| `expired`   | yes  | no    | Grace window closed, or trial ended           |
| `disabled`  | no   | no    | Platform administrator disabled the business  |

Two rules follow from this table and must not be broken:

1. **A business never loses its data.** Every state except `disabled` keeps full
   read access, so receipts and reports stay available while payment is sorted out.
2. **Selling never stops for a payment problem alone.** A failed charge moves the
   business to `grace`, not to read-only. Cancelling a subscription also leaves
   POS (sales, products, inventory) writable until the paid period ends.

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

Plan changes are **state transitions on one subscription row**, not a cancel-and-
rebuy. Upgrades are immediate after a confirmed payment. Downgrades are always
scheduled for `expiresAt` and never charge today.

**Upgrade.** `previewPlanChange` is the only amount the UI may show. Mid-cycle
the customer pays `remaining(new) − unused(current)` and keeps the current
period. Paystack initialize for that charge is a one-time amount (no plan code),
so the gateway cannot ignore the prorated figure. After the webhook activates
the new plan, `syncGatewayRecurring` points the next renewal at the new catalog
price.

**Downgrade.** `scheduleDowngrade` writes `scheduledChange` and a zero-amount
history row (`kind: scheduled_downgrade`). The organization stays on the current
plan until `effectiveAt`. Over-limit usage is a warning, never a delete, and
does not block the schedule. `cancelScheduledChange` removes the pending change
with no payment. Choosing the current plan again while a downgrade is scheduled
is the same cancel. Choosing a higher plan cancels the schedule and prorates
from the **current** plan, not the scheduled one.

**At period end.** `applyDueScheduledChanges` (daily cron) and
`applyGatewayRenewal` (webhook) apply the target plan, clear `scheduledChange`,
and leave existing records intact. Create-path limits then use the new plan.

Because a full-price recurring plan owns the amount, `startCheckout` updates the
Paystack plan to the current catalog price before **new** (non-prorated)
checkout. `billing:syncGatewayPlansInternal` does the same for every recurring
plan.

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

Administrators free a slot from Settings → Devices. The terminal in use cannot
be shut down or removed. Shut-down terminals can be re-enabled (uses a slot
again) or removed from the list. Administrators can shut down every other
activated device in one action. Platform administrators can clear every
activation with `billing.resetActivation` when hardware is replaced.

# Offline

The licence snapshot is cached in Dexie and re-evaluated locally with
`evaluateCachedLicense`. A cached licence is trusted for 30 days — deliberately
longer than the 7-day grace period, because losing connectivity is not a payment
problem. Past the TTL, `full_sync` and `backup_only` devices fall back to
read-only until they reconnect. An activated `local_only` organization or
lifetime licence does not require periodic cloud verification, but cached
suspension, disablement, grace, and expiry rules still apply.

Commercial local writes require one successfully cached licence. The installation
stores a separate activation marker so deleting the snapshot cannot reset it to a
permissive first-run state. A first-time device without a validated licence must
connect and activate; an established device with a missing, malformed, or
cross-organization snapshot enters licence-recovery read-only mode. Sales and
returns run this gate before allocating a document or returning a printable
receipt payload.

# Scheduled work

`convex/crons.ts` runs `billing.dailyMaintenance` once a day: sync the plan
catalog, push catalog prices onto Paystack recurring plans, apply due scheduled
downgrades, expire subscriptions whose grace window closed, and expire finished
trials.

# Deployment

Set on the Convex deployment (not just `.env.local`):

| Variable              | Purpose                                               |
| --------------------- | ----------------------------------------------------- |
| `PAYSTACK_SECRET_KEY` | Server-side Paystack calls and webhook verification   |
| `NOVEND_SITE_URL`     | Absolute base URL used to build the checkout callback |

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
