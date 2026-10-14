# Offline Sync

Version: 2.5.0 (Milliesmart)

## Purpose

Milliesmart is a single-store supermarket till. Dexie is the **business source
of truth** on each device. Convex is used for sign-in and licence cache only —
business sales, stock, and customers do not sync to the cloud.

Organizations are provisioned `local_only`. Missing / unknown cloud modes
normalize to `local_only`. Sync boost never elevates a till to `full_sync`.
Each till is its own database until a later local sync exists.

## Platform feature entitlements (offline)

`billing.licenseSnapshot` includes the resolved organization config
(`features`, `experience`, `billingVisibility`, `commercial`, `configVersion`)
from `resolveOrganizationConfig`. The client caches that payload in the Dexie
licence snapshot for offline boot.

- **Nav / routes** — disabled features stay hidden and route-guarded from the
  cached snapshot (same source as the online shell).
- **Local writes / outbox** — ops for a disabled feature are denied locally and
  existing pending rows are quarantined as `blocked_by_entitlement` (not
  deleted). Sync Center labels them “Blocked by plan”. When the feature is
  re-enabled and the snapshot refreshes, those rows can drain again.
- **Theme** — experience CSS variables are applied from the cached snapshot so
  offline boot keeps the org’s colours before Convex reconnects.

Do not scatter org-id conditionals. One resolver feeds the snapshot; offline
and online enforcement share that contract.

## Cloud mode decision points

How aggressively a device talks to the cloud is governed by the tenant's
`organizations.cloudMode` (see `CLOUD_MODE_PLAN_V1.md` / `CLOUD_MODE_PLAN_V2.md`).
The mode is resolved into a `CloudPolicy` (`convex/shared/cloudMode.ts`) and
enforced at these points:

- **OfflineProvider** gates `pullSnapshot` on `shouldUseRealtimeSubscriptions()`
  and `flushOutbox` on `shouldQueueRealtimeSync()`. Sync Center "Sync now"
  routes through the same functions, so the policy always applies — there is no
  escape hatch.
- **sync-engine** `drainOutbox` returns a no-op skip when
  `shouldQueueRealtimeSync()` is false.
- The mode originates from `organizations.cloudMode` via
  `billing.licenseSnapshot`, is cached in the Dexie license snapshot, and is read
  client-side through `lib/offline/cloud-policy.ts`. Missing / unknown values
  normalize to `local_only`. `persistBusinessWrite` keeps Dexie-only writes when
  realtime sync is off (no Convex mirror call).
- **Entitlement flags.** `cloudBackupEnabled` and `remoteMonitoringEnabled`
  (defaults: enabled) are ANDed into the policy: `resolveCloudPolicy(mode, {
cloudBackupEnabled, remoteMonitoringEnabled })`. A Super Admin can switch either
  off regardless of mode. `loadCloudPolicy()` passes both from the cached snapshot.
- **Scheduled upload (`backup_only` / `snapshot_only`).** `lib/offline/scheduled-backup.ts`
  `maybeRunScheduledCloudBackup` encrypts with the **sealed organization recovery
  key** (`lib/offline/recovery-key.ts`) — not a login password and not a Settings
  session field. `backup_only` uploads a full Dexie dump (`kind: "automatic"`);
  `snapshot_only` uploads a compact business package (`kind: "snapshot"`, built by
  `lib/offline/compact-snapshot.ts`). Cadence is `organizations.backupIntervalHours`
  (12h–30d; missing → 24h) via `platform.setOrganizationBackupInterval`. The hourly
  client timer only reads local state; Convex is contacted when the interval has
  elapsed. Skips when no recovery key is sealed on the device. `local_only` does
  not upload. Wired in `OfflineProvider`.
- **Recovery key.** Set once in Settings → Backups. Sealed on-device in
  **localStorage** (org-scoped). Cap does not use SecureStorage here — that
  plugin often hangs the WebView bridge (same pattern as biometric unlock
  tokens). Never stored in Convex. Rotate creates a new key for future uploads;
  older packages still need the previous key.
- **Fresh-device restore.** `CloudPackageRestoreGate` prompts an admin after login
  when mode is `backup_only` or `snapshot_only` and Dexie has no products/sales:
  enter recovery key → download latest `cloudBackups` row → decrypt → import →
  seal key on this device → reload. Last successful upload wins; no live merge.

## Cloud mode super admin control

- **`platform.setOrganizationCloudMode`** validates the requested mode against
  `resolveAllowedCloudModes(org)`, patches `cloudMode`, bumps the entitlement
  version, updates the `platformStats` cloud-mode counters, and audits the change.
  The PEAS licence panel exposes the Select (with a confirm dialog before
  `local_only`) next to Account status.
- **`platform.setOrganizationBackupInterval`** sets `backupIntervalHours` for
  automatic `backup_only` and `snapshot_only` uploads, bumps the entitlement
  version, and audits the change. The same licence panel exposes the interval. It
  does not slow `full_sync` and does not create uploads for `local_only`.

## Entitlement version

`organizations.entitlementVersion` (missing → 0) is a monotonic counter bumped by
`bumpEntitlementVersion` whenever plan, status, limit overrides, cloud mode, or
the backup/monitoring flags change (`assignPlan`, `setBackupLimit`,
`setOrganizationStatus`, `setOrganizationCloudMode`, `setOrganizationLimitOverrides`,
and `provisionOrganization` which starts at 1). It ships in `billing.licenseSnapshot`
and the platform telemetry heartbeat so offline clients can detect a stale cache.

## Platform telemetry heartbeat

Separate from the product-event pipeline (`platformEvents`) and from business
sync. `telemetry.recordHeartbeat` (`requireSessionIgnoringLicense`, so it works in
**every** cloud mode including `local_only`) writes a minimal
`platformTelemetryHeartbeats` row: cloud mode, plan, entitlement version, branch /
user / device counts (derived server-side), plus client-supplied app version,
storage estimate, last backup, and outbox counts. Deduplicated to at most one write
per 24h unless a meaningful field changes. The client (`lib/telemetry/heartbeat.ts`)
is wired into `OfflineProvider` and runs on mount / focus / reconnect, **not** gated
by the cloud policy — `local_only` means business sync off, heartbeat on.

## Local backup recovery

Restore-from-cloud is implemented in `CloudBackupCard` (`onRestore`) and
`CloudPackageRestoreGate`: download via `cloudBackups.backupDownloadUrl` →
`parseBackupPayload(text, recoveryKey)` → `importOfflineBackup(payload)`. The
organization recovery key encrypts both this-device and cloud packages.

## Data flow

```text
UI
↓
Repository / Dexie replica
↓
Sync outbox
↓
Convex (when online)
```

1. While online, `offline.getSnapshot` pulls a branch-scoped replica into IndexedDB
   (catalog, customers, orders, suppliers, wholesale, branches, users, expenses,
   staff compensation, returns, expiry lots, product photos).
2. Screens always render from Dexie when the replica is warm. Live Convex is
   used as a freshness shortcut, never as a gate to open the page. **Returns**
   (and Orders) are cashier-scoped: the Dexie list and Convex `returns.list` /
   `returns.get` only include refunds on that cashier's sales. Opening another
   cashier's return is not found, not a permission error. **Staff performance and
   payroll** (compensation, salary, commission) mirror into Dexie for
   administrators and managers; writes queue to the outbox and sync when online.
   Audit **activity** for a user still requires a network connection.
3. Writes apply locally, then enqueue an outbox event (`upsert_supplier`,
   `record_wholesale_purchase`, `record_supplier_payment`, `complete_sale`, `upsert_product`,
   `update_lot_expiry`, …). Product
   **imports** use the same outbox: Dexie first, then Convex `createProduct` /
   `updateProduct`. Catalog CSV/Excel exports read the local list and work offline.
4. `OfflineProvider` drains the outbox in the background. Forms return as soon as
   Dexie succeeds — loading spinners never wait on Convex. **Background drains are
   silent** — the shell never shows a global “Syncing…” spinner. While offline (or
   while the till has no Convex JWT), the sidebar chip stays calm (“Offline · N
   saved on this device” / “Cloud disconnected”). Conflict / needs-attention chrome
   appears only when online **and** authenticated. Explicit upload progress appears
   in **Sync Center** when the user taps Sync now. After a successful
   Convex write, the matching `local_*` Dexie row is deleted. Snapshot merge and
   list reads also drop a pending local row when Convex already has the same
   business identity (purchase invoice, transfer, return number, expense,
   sale invoice) so a single action cannot paint twice until the next reload.
5. Product photos live in IndexedDB (`productImages`) as blobs plus thumbnails.
   The UI reads local blobs first and falls back to the cloud URL only when the
   replica has no photo yet.
6. The dashboard is built only from Dexie (`buildLocalDashboardSummary`). It
   never calls Convex `dashboard.summary`. Restock, sales, and returns refresh it
   via `replica-changed`. Administrators and managers see a **rolling last 7 days**
   of sales and orders (not all-time totals). Cashiers see **today** from midnight,
   **only their own sales**, and refunds against those sales — never another
   cashier's returns. Sign-out deletes the org Dexie replica and session
   `localStorage` keys (device identity and hardware pairing stay) so the next
   login cannot inherit the previous user's cache. An in-flight snapshot fetched
   before a local wholesale/sale write is discarded so auto-sync cannot roll the
   UI back until Convex has the new row.
   The replica also keeps only the most recent ~200 completed sales, so older
   orders drop out of the dashboard even inside that window. Top selling ranks
   locally (quantity by default; the cashier can toggle amount). The ranking
   preference is stored on the device.
7. Barcode scans look up `products.barcode` (then SKU) in Dexie only.

## Local writes

`persistBusinessWrite` always applies the Dexie + outbox path, then asks the
provider to flush while online. Branch create/update and product create (including
photos) use that path. **Sales checkout (`Pay`) and returns always write locally
first** (`completeSaleLocally` / `processReturnLocally`) so Capacitor cannot
treat `navigator.onLine` as “Convex is reachable” and leave in-flight pays to
complete later.

Saving a product with a typed **new category** name creates that category in
Dexie and assigns it on the same save — the Add click is optional. After
`create_category` syncs, `rekeyCategoryReferences` remaps both pending outbox
JSON and Dexie `products.categoryId` from the local id to the Convex id so the
product does not fall back to Uncategorized. A product that is waiting on that
remap is **not** a Sync Center conflict — "Waiting for the category to finish
syncing" stays in Waiting and retries. Convex `categories.create` returns the
existing row when the name/slug already exists so a second save does not stall.

## Credit, price lists, and warehouse lots (wholesale)

These extend the existing mirror and outbox — there is no second sync protocol.

| Convex data                                        | Dexie store / field                  | Outbox op                                                  |
| -------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| `salePayments` (split tenders)                     | `LocalSale.payments`, `MirroredOrder.payments` | `complete_sale` payload `payments` (always normalized)  |
| `customers.creditLimit` / `balance`                | `customers`                          | `upsert_customer` (terms) · `record_customer_payment`      |
| `customerLedgerEntries`                            | `customerLedger`                     | — (server-written; replaced on snapshot)                   |
| `customerGroups`, `customers.customerGroupId`      | `customerGroups`                     | `upsert_customer_group`                                    |
| `priceListRules`                                   | `priceListRules`                     | `upsert_price_rule`                                        |
| `wholesaleLots`                                    | `wholesaleLots` (Dexie v15)          | `record_wholesale_purchase` · `wholesale_transfer`         |

- `getSnapshot` returns the ledger, groups, rules and warehouse lots; the client
  replaces server rows and keeps only pending `local_*` rows.
- **Customer balance.** Checkout and `queueRecordCustomerPayment` change the
  local balance immediately. On each snapshot the server balance is overlaid
  with only **pending/syncing** outbox rows (`overlayPendingCustomerBalances`),
  so a synced row is never counted twice. A permanently failed sale rolls its
  on-account charge back once (`markLocalSaleFailed`).
- **Credit conflicts.** If another till exhausts the limit first, upload fails
  with "Credit limit exceeded" (also: credit not enabled, customer required).
  `describeOutboxConflict` shows these as permanent business conflicts, not
  retryable network errors.
- **Pricing.** `completeSaleLocally` resolves prices with the same pure
  `resolveUnitPrice` as Convex and uploads lines as sold snapshots (`unitPrice`,
  `baseQuantity`), so the server does not reprice an offline sale.
- **Capabilities** (`customer_credit`, `customer_pricing`) are checked at queue
  time from the cached business configuration; Convex re-checks on upload.
- **Warehouse lots.** `wholesaleLots` is cleared and rebuilt on each snapshot and
  pending purchases/transfers are replayed on top (`replayPendingWarehouseLots`)
  so a pull cannot resurrect issued stock. Offline transfers of dated products
  issue FEFO from these lots and create branch lots locally.
- **Returns to credit** are online-authoritative: the ledger adjustment is
  written by Convex and the balance refreshes on the next sync.

## List reads

Catalog and history screens (Products, Inventory, Customers, Orders) **page**
the replica. Products also paginate the Convex `listProducts` query so a cold
online paint does not `getUrl` every image. Default page size is 20
(`constants/list-page.ts`). Sales POS search stays unpaged.

When the Dexie mirror is warm (`canServeListsFromMirror`), list hooks **skip**
the live Convex subscription. This includes Products, Inventory, Orders, and
**Sales catalog** (`useSalesCatalog`). Snapshot sync + `novend:replica-changed`
keep the replica current. Local joins (product → category / branch stock / lots)
stay in `lib/offline/mirror-queries.ts` — do not add a second query language.

Downloads / Releases use Convex `useQuery` as the pub/sub. Publishing a
release updates the documents; subscribed clients refresh without an interval
poll. See `hooks/use-release-offers.ts`.

## Startup

Network checks never block rendering.

```text
Load Dexie
↓
Restore session
↓
Render from local modules
↓
Check connectivity in the background
↓
Pull snapshot + drain outbox
```

## What still needs a connection

These cannot complete locally without weakening security or talking to a
payment network:

- **First** login, signup, and onboarding on a new device
- Creating a new login (password is stored by Convex Auth)
- Changing a password
- Paystack checkout and live billing mutations
- Cloud backup upload/download (Settings → Backups; always encrypted). The
  file envelope lists PBKDF2/AES-GCM salt and IV so restore can run; those
  are public parameters, not the password.
- Desktop auto-update download

After the first successful online sign-in, this device keeps an **offline
session** (local shell profile + Dexie replica) for up to **30 days**, plus a
**device-local password digest** (PBKDF2) for that email. Closing the Cap app
does **not** sign you out. Cold start can resume an already-open shell from
cache when offline or when Convex is slow.

The inactivity lock (`WorkspaceLockOverlay`) follows the same rule. With a live
Convex session it verifies the password with `users.verifyPassword`. Offline, or
online while the till is still waiting for a JWT, it checks the device digest
for the locked user's email and also requires the digest's `userId` to match
that user. If the device has no digest for that user, the password cannot be
checked; the user has to use biometrics or reconnect.

The offline shell is **local custody only** — it does not mint a Convex Auth
JWT. Cloud mutations (outbox drain) require a JWT. Sync chrome stays calm while
offline or while the radio is up but the till still has no JWT (“Cloud
disconnected”). When the network returns, a non-blocking **Connect to cloud**
banner asks for the password in place (same email as the offline session); after
`signIn`, the outbox flushes without sending the cashier to `/login`. The shell
must stay mounted while online-but-unauthenticated: middleware only sees cookies,
so a document fetch that followed a 302 to `/login` would otherwise dump the till
mid-shift. The service worker refuses to paint that login document under an app
URL when a cached shell exists.

Because the shell stays mounted with radio but no JWT, “online” alone never
opens a Convex subscription. Tenant and platform reads use `useAuthedQuery`
(`hooks/use-authed-query.ts`), which skips until `useConvexAuth` reports a
session; `useConvexPagedList`, `useBusinessDataGate`, and the Sales catalog gate
apply the same rule and serve Dexie meanwhile. A plain `useQuery` on a
`requireRole` query would throw `Unauthenticated` during render and replace the
Connect-to-cloud prompt with the error boundary. Plain `useQuery` is reserved for
public queries and ones that return a safe value when signed out (`users.me`,
`platform.me`); `tests/authed-query-gate.test.ts` enforces the allowlist.

**Shared tills / multiple staff.** Every account that signs in on the device is
remembered in `novend.offlineSessions`. **Login always uses the same email +
password form** — online against Convex Auth, offline against the device digest
then the remembered shell. There is no passwordless account picker. Wrong
offline passwords are rejected. The first login on a new device (or after the
digest or session expires) still requires the network so the digest can be stored.
When an administrator or manager creates a staff account on this till, the till
stores that person's password digest and a workspace hint immediately. The
password is not written to the outbox. That person can sign in offline on this
same till. A different device still needs one online sign-in for them.
Online never auto-resumes a cached shell (Electron reconnect included). After
password sign-in, the live Convex `me` profile rebinds Dexie so the previous
offline cashier cannot stay active. Lifetime (and local-only) licence snapshots
are mirrored per organization on the device so a second cashier does not hit
“activation required” offline just because their Dexie replica is new.

**Sale timestamps.** Checkout is Dexie-first: the till stamps `completedAt`
with the device clock when Pay succeeds (receipts and local reports use that).
Outbox sync sends that stamp to Convex as `clientCompletedAt`. Convex stores it
as `completedAt` (after skew checks: not more than ~5 minutes ahead or ~30 days
behind server time) and sets `syncedAt` to server ingest time. Day/range reports
and Orders list by `completedAt` so CCTV / till wall time stay aligned after
reconnect. Legacy sales may omit `syncedAt`.

Name, phone, catalog, inventory, wholesale, suppliers, customers, expenses,
sales, returns, reports, analytics, **admin/manager branch switching**, and
**per-batch expiry edits** all continue on the device. Reports and Analytics
summaries build from Dexie when offline (or when Cap reports online but Convex
does not answer). While online, Reports calls `mergeSalesReportWithLocal` so
period KPIs, daily breakdown rows, and **Cash / MoMo / Card tender totals**
include unsynced checkouts that Orders already shows on this till. Analytics
prefers the local summary when this device has a higher order count than the
cloud (same gap). Day detail merges device-only invoices into the order list
and recomputes that day’s payment totals from the merged list. Payment totals
are gross by single tender (`cash` | `mobile_money` | `card`) — same buckets as
the end-of-day SMS digest. Inventory value on Reports and Analytics is a cloud
query: it replays branch stock movements and prices them at today's cost and
selling price. The card shows the value at the start of the selected period and
at the end, then an administrator or manager can look up the day that value
matched an amount. It is not in the Dexie replica, so the card asks for a
connection when the till is offline. An administrator can complete a sale for
any branch already in the device snapshot, including a branch that is not their
home branch, without a connection. The admin snapshot stores stock for every
branch, and the sale is tagged with that branch. Branch pickers read the Dexie
`branches` table — they must not wait on `navigator.onLine`. A stuck IndexedDB
upgrade (missing `meta` / `productImages` / `lots`) rebuilds that replica on
open, then the next snapshot refill.

## Conflict policy

Queue order + server validation. Inventory cannot become negative on Convex.
Cashiers resolve failed syncs from Sync Center: **Fix** (open the record and
change what the server asked for), then Retry, or Discard. Local `local_*` ids are
remapped after creates succeed. Snapshot merge keeps only **pending** `local_*`
rows so a synced wholesale purchase, expense, or supplier is not shown beside
the server row.

Outbox retries are idempotent: sales and returns use `saleClientOps` /
`saleReturnClientOps`; wholesale, inventory, and expenses use
`mutationClientOps` keyed by `(organizationId, clientOperationId)`. Online
checkout also sends `clientOperationId` so a retried Pay is one sale. The
invoice (or return number) printed at checkout is sent on the outbox event and
stored as the Convex invoice — sync must not mint a second number. A wholesale
purchase that creates a product waits for the product outbox row to sync (local
ids are remapped) before the purchase mutation runs.

A cloud refresh replaces device stock with the server’s quantities. Pending
sales and returns are applied back onto that snapshot (`overlayPendingBranchStock`),
including rows already marked failed. Without that, a reconnect during an
offline day restored the morning count, the till sold those units again, and
close-of-day upload then rejected the extras as “Not enough stock”.

These uploads are still recorded:

- **Two tills, one branch, same units.** Each device sold from the morning
  snapshot. The first upload reduces branch stock. A later printed receipt
  that would take stock below zero is still saved. Novend removes only the
  units still on that branch, records the shortage, and does not invent stock.
  The sale then appears in Orders and Reports. The same path covers a receipt
  sold while the product was non-stock, then uploaded after stock tracking was
  turned on. A failed stock row is reopened on the next sync so it does not
  stay on the till. Live checkout, before a receipt exists, still refuses the
  sale when the branch does not have the units.
- **The catalog changed after the sale.** A price, pack size, or deactivated
  product used to be re-checked against the live catalog, so a discount that
  fitted the printed price failed, or “Sell unit not found” / “Product
  unavailable” failed a sale that had already been paid. The upload now sends
  the printed price and the base quantity the till removed. Live checkout still
  uses the current catalog.
- **Product edit rewrote stock.** Saving a name or price also sent the stock
  figure on the form. On a dated product that throws “Use Inventory or Expiry
  lots…”. On any product it could set the branch back to a stale count before
  the day’s sales uploaded, and those sales then failed stock. A save now sends
  stock only when that number was changed. If the queued number already matches
  the branch, the server leaves stock alone.
- **One bad row stopped the queue.** A non-final rejection used to stop the
  drain, so the rest of the day’s sales never uploaded in that pass and later
  showed up as conflicts. A business rejection is recorded on that row and the
  drain continues. A network failure still stops the pass. Convex
  “changed while this mutation was being run” stays pending and is not a conflict.
- **Opaque “Sync failed” dumps.** A brief disconnect can return a Convex wrapper
  with no business reason. Classifying that dump as a conflict marked the row
  failed; Sync Center reopened it every poll and burned attempts while the sale
  already sat in Orders. Those placeholders stay pending with backoff and show
  under Waiting, not Conflicts. Reports Daily Orders merge device-only sales so
  the day list matches Orders until the upload finishes.
- **SKU already exists, forbidden, and a real stock edit on a dated product**
  are still conflicts. The message in Sync Center is the server reason.

The sidebar chip is the only always-on offline indicator. The top banner
appears only when sync items need attention (failed / exhausted retries). **Sync
Center** (from the chip) lists waiting uploads, server conflicts, and recently
synced events. **Sync now** bypasses retry backoff and re-queues failed rows.
Failed / blocked outbox rows older than **7 days** are cleared automatically on
the next drain (same stock restore as Discard) so cashiers who cannot navigate
per-row Discard — e.g. Global Medicine tills — heal without support. Sync Center
also shows **Clear old problems** for the same week-old set. Transient network
failures stay `pending` with exponential backoff (see
`lib/offline/outbox-policy.ts`). Definitive validation rejections (expiry, SKU,
stock, forbidden) move to `failed` immediately; ambiguous errors retry up to
`MAX_OUTBOX_UPLOAD_ATTEMPTS` before surfacing as needs attention. Fix updates the
same outbox payload so Retry does not resend the rejected data.

## Offline navigation

Next.js App Router RSC fetches fail offline and feel slow online (network round-trip
plus `loading.tsx` flash). Inside the authenticated shell, in-app navigation uses
`history.pushState` and a client outlet both **online and offline**, so the sidebar
stays mounted and tab switches are instant. The URL remains the source of navigation
state; the service worker may serve a cached shell HTML document for an uncached deep
path without rewriting the browser location — `OfflineNavigationProvider` /
`resolveOfflineView` honor `location.pathname`. Document navigations are
**network-first** (`novend-pos-v29`), except Capacitor/Electron `?fromBoot=1`
navigations which are **cache-first** so a dead radio does not stall cold
start. Auth documents (`/login`, `/signup`) prefer a **validated** cache entry
when `fromBoot=1` or `signedOut=1` (HTML must look like the login/signup form —
the `X-Novend-Auth-Doc` header alone is not enough). `novendFresh=1` forces
network-first so escape hatches can bypass a poisoned shell. Sign-out leave
never appends `fromBoot` on Electron, and only appends it on Capacitor when
`navigator.onLine === false`; offline-boot trampolines also skip `fromBoot`
when the entry already has `signedOut=1`. App-route fallbacks are `/dashboard`, `/sales`, and `/platform` only —
never the marketing homepage (`/`). The worker does **not** intercept `/`:
signed-in visits 302 to `/dashboard` in the browser so the POS splash cannot
paint on the marketing URL. Precache also omits `/` and gated app shells so
`cache.add` cannot store dashboard HTML under a marketing key or follow an
auth 302 into PRECACHE. Authenticated shells are warmed after login and
**migrated** into the new `CACHE_NAME` bucket on activate — wiping old caches
without migration used to break Cap/Electron airplane-mode cold start after
every SW bump. The worker unwraps
followed redirects so Chrome does not paint `ERR_FAILED` on login → dashboard.
`/login` and `/signup` use network-first with a cached login fallback when fetch fails.
When a shell HTML document is cached, its `/_next/static/` script and stylesheet
URLs are co-cached so a mid-deploy offline reopen does not paint a blank page.
Capacitor registers the same worker after
one online open so cold start can load Cache Storage; Dexie remains the
operational replica. The worker never stores a followed `/login` document
under an app-shell URL. Static assets still use stale-while-revalidate.

### Deep links and return URL

Unauthenticated visits to app routes redirect to `/login?next=…` with a
same-origin path validated by `lib/auth/safe-return-path.ts`. After sign-in,
`resolvePostAuthPath` restores that path unless onboarding or platform-admin
defaults take priority.

### Cold start last route

Capacitor and Electron boot pages open the hosted app with `?fromBoot=1`. The
app then restores `localStorage` key `novend.lastRoute` (written on successful
in-app navigation) once, so reopen lands on the last screen instead of always
`/dashboard`.

## Super Admin (platform)

Platform console screens use the same IndexedDB stack under a dedicated
`novend-offline-platform-{userId}` replica. While online, overview, organization
lists, org detail, and release metadata are written into Dexie `meta`. While
offline, those screens paint from cache; mutating tenants (create org, reset
password, license edits) still requires a connection.

## Local data security (P0-3)

The live Dexie replica is **plaintext within the browser / WebView profile**.
Protections are layered as:

1. TLS for cloud traffic
2. Password-encrypted portable / cloud backups
3. Device/OS/browser custody for the operational store
4. Explicit logout deleting the bound org/user replica (including `productImages`)
   without deleting other tenants’ databases
5. Configurable inactivity lock (Settings → Security; default 10 minutes) that
   requires Convex Auth password reauthentication (optional native biometrics)

**Deferred:** field-level encryption of sensitive Dexie fields. Do not invent
weak custom cryptography; any future design needs audited libraries and key
management. See `docs/development/14-SECURITY_GUIDE.md` (Local-device threat
model).

## Desktop and Capacitor

Electron first-run must load the hosted app so the service worker and Dexie
initialize. Later launches client-navigate from `offline-boot.html` straight
to `/dashboard?fromBoot=1` (no `/api/health` gate). See `DESKTOP_PLATFORM.md`.

Capacitor Android/iOS use the same cache-first boot (`apps/mobile/www/index.html`).
See `CAPACITOR_MOBILE.md`.

## Billing (offline-aware)

Settings → Billing renders from Dexie (`billingOverview`, `billingHistory`,
`licenseSnapshot`), including any scheduled downgrade. Pay / Subscribe / Upgrade
/ Renew / Schedule require a connection and must not hide the rest of the
billing page or lock the POS. Downgrades never delete existing records; over-
limit usage is a warning and create-path limits apply after the effective date.
The last valid licence snapshot keeps selling while offline within its policy.
`full_sync` and `backup_only` snapshots become read-only after the licence TTL;
activated `local_only` and lifetime licences continue without periodic checks.
A new installation must cache one valid licence before commercial writes.
Missing, malformed, or tenant-mismatched licence data on an established
installation enters recovery/read-only mode. The local repositories enforce this
before writing a sale, return, product, user, or branch, so a rejected operation
cannot produce a final-looking receipt or a misleading completed-sale message.
