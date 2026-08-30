# Offline Sync

Version: 2.4.14

## Purpose

Keep every operational Novend screen usable without a network. Dexie is the
**operational replica** the UI reads and writes. Convex remains the
**committed cloud replica**: it authenticates, authorizes, validates, and
stores canonical state when a device is online.

This is local-first operations, not a second source of truth. Negative
inventory and immutable completed sales are still enforced when the outbox
drains to Convex.

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
   returns, product photos).
2. Screens always render from Dexie when the replica is warm. Live Convex is
   used as a freshness shortcut, never as a gate to open the page.
3. Writes apply locally, then enqueue an outbox event (`upsert_supplier`,
   `record_wholesale_purchase`, `complete_sale`, `upsert_product`, …). Product
   **imports** use the same outbox: Dexie first, then Convex `createProduct` /
   `updateProduct`. Catalog CSV/Excel exports read the local list and work offline.
4. `OfflineProvider` drains the outbox in the background. Forms return as soon as
   Dexie succeeds — loading spinners never wait on Convex.
5. Product photos live in IndexedDB (`productImages`) as blobs plus thumbnails.
   The UI reads local blobs first and falls back to the cloud URL only when the
   replica has no photo yet.
6. The dashboard is built only from Dexie (`buildLocalDashboardSummary`). It
   never calls Convex `dashboard.summary`. Restock, sales, and returns refresh it
   via `replica-changed`. Top selling ranks locally (quantity by default; the
   cashier can toggle amount). The ranking preference is stored on the device.
7. Barcode scans look up `products.barcode` (then SKU) in Dexie only.

## Local writes

`persistBusinessWrite` always applies the Dexie + outbox path, then asks the
provider to flush while online. Branch create/update and product create (including
photos) use that path. **Sales checkout (`Pay`) and returns always write locally
first** (`completeSaleLocally` / `processReturnLocally`) so Capacitor cannot
treat `navigator.onLine` as “Convex is reachable” and leave in-flight pays to
complete later.

## List reads

Catalog and history screens (Products, Inventory, Customers, Orders) **page**
the replica. Products also paginate the Convex `listProducts` query so a cold
online paint does not `getUrl` every image. Default page size is 20
(`constants/list-page.ts`). Sales POS search stays unpaged.

When the Dexie mirror is warm (`canServeListsFromMirror`), list hooks **skip**
the live Convex subscription. Snapshot sync + `novend:replica-changed` keep
the replica current. Local joins (product → category / branch stock / lots)
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

Name, phone, catalog, inventory, wholesale, suppliers, customers, expenses,
sales, returns, reports, and analytics all continue on the device.

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
appears only for active uploads and sync conflicts. **Sync Center** (from the
chip) lists waiting uploads, server conflicts, and recently synced events.
**Sync now** bypasses retry backoff and re-queues failed rows. Validation
rejections (expiry, SKU, stock, forbidden) are conflicts — they do not stay in
Waiting and they do not stop later events in the queue. Fix updates the same
outbox payload so Retry does not resend the rejected data.

## Offline navigation

Next.js App Router RSC fetches fail offline and feel slow online (network round-trip
plus `loading.tsx` flash). Inside the authenticated shell, in-app navigation uses
`history.pushState` and a client outlet both **online and offline**, so the sidebar
stays mounted and tab switches are instant. The URL remains the source of navigation
state; the service worker may serve a cached shell HTML document for an uncached deep
path without rewriting the browser location — `OfflineNavigationProvider` /
`resolveOfflineView` honor `location.pathname`. Document navigations are
**network-first** (`novend-pos-v11`), except Capacitor/Electron `?fromBoot=1`
navigations which are **cache-first** so a dead radio does not stall cold
start: the worker unwraps followed redirects so Chrome does not paint
`ERR_FAILED` on login → dashboard. `/login` and `/signup`
are not intercepted. Capacitor registers the same worker after one online
open so cold start can load Cache Storage; Dexie remains the operational
replica. The worker never stores a followed `/login` document under an
app-shell URL. Static assets still use stale-while-revalidate.

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
The last valid licence snapshot keeps selling while offline.
