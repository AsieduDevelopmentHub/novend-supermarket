# Offline Sync

Version: 2.4.27

## Purpose

Keep every operational Novend screen usable without a network. Dexie is the
**operational replica** the UI reads and writes. Convex remains the
**committed cloud replica**: it authenticates, authorizes, validates, and
stores canonical state when a device is online.

This is local-first operations, not a second source of truth. Negative
inventory and immutable completed sales are still enforced when the outbox
drains to Convex.

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
  normalize to `full_sync`, so existing tenants and stale caches keep today's
  behaviour with no migration.
- **Entitlement flags.** `cloudBackupEnabled` and `remoteMonitoringEnabled`
  (defaults: enabled) are ANDed into the policy: `resolveCloudPolicy(mode, {
cloudBackupEnabled, remoteMonitoringEnabled })`. A Super Admin can switch either
  off regardless of mode. `loadCloudPolicy()` passes both from the cached snapshot.
- **Scheduled backup (`backup_only`).** `lib/offline/scheduled-backup.ts`
  `maybeRunScheduledCloudBackup` runs a daily encrypted cloud backup
  (export → encrypt → upload → `cloudBackups.recordBackup({ kind: "automatic" })`)
  when the policy queues backups but not realtime sync. It never flushes the
  outbox and silently skips when no backup password is available this session
  (the password is held in memory only via `backup-password.ts`, never persisted).
  Wired in `OfflineProvider`.

## Cloud mode super admin control

- **`platform.setOrganizationCloudMode`** validates the requested mode against
  `resolveAllowedCloudModes(org)`, patches `cloudMode`, bumps the entitlement
  version, updates the `platformStats` cloud-mode counters, and audits the change.
  The PEAS licence panel exposes the Select (with a confirm dialog before
  `local_only`) next to Account status.

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

Restore-from-cloud is implemented in `CloudBackupCard` (`onRestore`): download the
stored file via `cloudBackups.backupDownloadUrl` → `parseBackupPayload(text,
password)` → `importOfflineBackup(payload)`. It uses the same backup password as
cloud upload and this-device backups.

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
   `record_wholesale_purchase`, `complete_sale`, `upsert_product`,
   `update_lot_expiry`, …). Product
   **imports** use the same outbox: Dexie first, then Convex `createProduct` /
   `updateProduct`. Catalog CSV/Excel exports read the local list and work offline.
4. `OfflineProvider` drains the outbox in the background. Forms return as soon as
   Dexie succeeds — loading spinners never wait on Convex. **Background drains are
   silent** — the shell never shows a global “Syncing…” spinner. The sidebar chip
   shows queued / synced / needs-attention only; explicit upload progress appears
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
session** (local shell profile + Dexie replica) for up to **30 days**. Closing
the Cap app does **not** sign you out. Cold start resumes from cache when
offline or when Convex is slow — you only need the network again for the
first login on a new device, after an explicit Sign out, or when the offline
session expires.

**Shared tills / multiple staff.** Every account that signs in on the device is
remembered in `novend.offlineSessions`. Login shows an account picker when more
than one shell is cached (or after Sign out). **Online never auto-resumes** a
cached shell (Electron reconnect included) — password sign-in or an explicit
picker tap always wins, and the live Convex `me` profile rebinds Dexie so the
previous offline cashier cannot stay active. Lifetime (and local-only) licence
snapshots are mirrored per organization on the device so a second cashier does
not hit “activation required” offline just because their Dexie replica is new.

Name, phone, catalog, inventory, wholesale, suppliers, customers, expenses,
sales, returns, reports, analytics, **admin/manager branch switching**, and
**per-batch expiry edits** all continue on the device. Branch pickers read the
Dexie `branches` table — they must not wait on `navigator.onLine`. A stuck
IndexedDB upgrade (missing `meta` / `productImages` / `lots`) rebuilds that
replica on open, then the next snapshot refill.

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

The sidebar chip is the only always-on offline indicator. The top banner
appears only when sync items need attention (failed / exhausted retries). **Sync
Center** (from the chip) lists waiting uploads, server conflicts, and recently
synced events. **Sync now** bypasses retry backoff and re-queues failed rows.
Transient network failures stay `pending` with exponential backoff (see
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
**network-first** (`novend-pos-v15`), except Capacitor/Electron `?fromBoot=1`
navigations which are **cache-first** so a dead radio does not stall cold
start. App-route fallbacks are `/dashboard`, `/sales`, and `/platform` only —
never the marketing homepage (`/`). The worker does **not** intercept `/`:
signed-in visits 302 to `/dashboard` in the browser so the POS splash cannot
paint on the marketing URL. Precache also omits `/` so `cache.add` cannot
store dashboard HTML under that key (`novend-pos-v15`). The worker unwraps
followed redirects so Chrome does not paint `ERR_FAILED` on login → dashboard.
`/login` and `/signup` use network-first with a cached login fallback when fetch fails.
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
