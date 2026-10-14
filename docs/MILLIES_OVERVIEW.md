# Millie's Supermarket POS — Full Overview

Version: 1.0.0

> Product overview for the Millie's Supermarket till. This clone is derived from
> Novend POS but is **not** the multi-industry SaaS product. Read this first for
> how the stack fits together; constitutional engineering rules still live in
> `PROJECT_CONSTITUTION.md` and satellites under `docs/architecture/`.

---

## 1. What it is

**Millie's Supermarket POS** is a single-store, supermarket Point of Sale for
cashiers and managers at Millie's. The on-screen brand is **Millie's Supermarket**.
The only Novend credit is the fixed receipt line `Powered by Novend POS`.

It is built for:

- Fast checkout (barcode, packs, weight where enabled)
- Stock that cannot go negative without a recorded reason
- Working through network outages after the first online sign-in
- One physical store — not multi-branch, not wholesale warehouse, not hotel/restaurant

It is **not**:

- A public marketing website
- A multi-industry SaaS for many unrelated shops choosing packs at signup
- A live multi-till cloud stock sync product (each till keeps its own Dexie database)

---

## 2. Stack

| Layer | Technology | Role |
| --- | --- | --- |
| UI | Next.js App Router (TypeScript), React | Screens, routing, layouts |
| Styling | Tailwind CSS v4 + CSS tokens | Millie's red / navy theme |
| Business API | Convex | Auth, licence snapshot, org provision (local-only) |
| Local business data | Dexie (IndexedDB) | Sales, products, stock, customers on this till |
| Package manager | pnpm (workspace) | App + `packages/hardware` + desktop/mobile shells |
| Desktop shell | Electron (`apps/desktop`) | Windows/macOS/Linux wrapper around the app |
| Mobile shell | Capacitor (`apps/mobile`) | Android wrapper around the app |
| Hardware | `@novend/hardware` | Print, biometrics, share, filesystem bridges |
| Printing | ESC/POS + browser print | Receipts and kitchen/ticket paths where used |
| Tests | Vitest | Contract and unit tests under `tests/` |

```text
Browser / Electron / Capacitor
        │
        ▼
Next.js UI (features/, components/, app/)
        │
        ├──► Dexie (IndexedDB)     ← business reads & writes on this device
        │
        └──► Convex (when online)  ← sign-in, licence cache, first bootstrap only
```

### How the layers divide responsibility

- **UI** paints and collects input. It never decides inventory or sale integrity alone.
- **Dexie** is the **business source of truth on the till**. Completed sales, stock
  movements, catalog edits, and customers live here while the store sells.
- **Convex** authenticates users, issues/caches the licence, and provisions the
  organization as `local_only`. It does **not** receive routine business sync for
  sales or stock in this product.
- **Shared validators** under `convex/shared/` still encode business rules
  (non-negative stock, immutable sales, capability checks). Offline repositories
  reuse those helpers so local writes stay consistent with the same rules.

---

## 3. Brand and industry

| Concern | Decision |
| --- | --- |
| Legal / display name | Millie's Supermarket |
| Logo | `docs/design/branding/milliesmart.png` → `public/branding/brandmark.png` |
| Primary | `#ED0206` (logo red) |
| Sidebar / navy | `#012561` (logo navy) |
| Industry pack | `supermarket` only: multi-unit pricing, lots & expiry, sell-by-weight, configurable POS |
| Branches UI | Hidden (`SINGLE_STORE`) — one implicit branch remains in data |
| Wholesale UI | Removed from navigation; routes redirect away |
| Marketing / legal site | No public website; `/` and old marketing paths go to `/login` |

Palette detail: [`docs/design/branding/colors.md`](./design/branding/colors.md).

---

## 4. How a day at the till works

### First-time setup (needs network once)

1. Staff open the app (web, desktop, or mobile shell).
2. Owner signs up / signs in against Convex.
3. Onboarding creates the store with industry `supermarket` and cloud mode `local_only`.
4. Licence and shell profile are cached in Dexie.
5. Admin adds products, categories, suppliers, and opening stock.

After that, selling does not require a live connection.

### Everyday selling

```text
Start today (optional) → Cart → pay → receipt
         │                    │
         ▼                    ▼
   Dexie till session   Dexie sale + stock
   (float / cash-up)          │
                              ▼
                    Print (Powered by Novend POS)
```

- **Till is Dexie-only** — Start today / Close today never call Convex. Expected
  cash = opening float + cash sales − returns on this device.
- If the cashier has not started, the **first completed sale auto-starts** today
  with opening float `0`.
- Held carts do not reduce stock until checkout completes.
- Returns use return workflows; completed sales are not edited.
- Cashiers cannot reach catalog, pricing, or settings that belong to admin/manager.
- Closed till sessions appear on **Reports** (day + recent) and **Analytics**.

### Offline selling

1. Sign in online at least once on the device so the licence and catalog mirror exist.
2. Lose network — the PWA/Electron/Capacitor shell + Dexie keep the workspace open.
3. Sales and stock changes write only to Dexie.
4. Reconnect — there is **no** automatic push of business rows to Convex. The till
   remains authoritative for that device's data.

### Multi-device reality

Each installation has its own IndexedDB. Two tills do **not** share live stock
in real time. Move a store to a new PC/tablet by restoring an encrypted backup
(see §8a). Treat one till as the operational system unless you restore onto the
replacement.

---

## 5. Authentication and roles

| Role | Typical access |
| --- | --- |
| Cashier | Sales, hold/resume, orders list, returns (as permitted), customers, reports they are allowed |
| Manager | Catalog/inventory ops, suppliers, analytics/reports, staff in scope |
| Administrator | Users, settings, backups, full store configuration |

Permissions are role-based and enforced in Convex for any server call. Offline
writes still check local licence and feature/capability caches so a cashier cannot
unlock admin tools by editing the UI.

### How accounts and sign-in work (online vs offline)

Millie's is **not** Chemist-style fully local users. Staff identities use
**Convex Auth Password** (cookie sessions) — not Clerk and not Dexie-only users.
The till becomes offline-*capable* after the first successful online sign-in on
that device.

```text
First time (needs network)
  Sign in / sign up → Convex Auth Password
       → org provisioned as local_only
       → licence + shell profile cached in Dexie / localStorage
       → password verifier (PBKDF2 digest) sealed on device for that email
       → offline session hint registered for this staff member

Later (network optional — Cap / Electron / true offline)
  Open app → remembered offline session can resume the shell
  Or /login → email + password checked against the local digest
       → activates that staff's offline session (no Convex round-trip)
  If Convex is unreachable while radio looks "online", Cap/Electron can still
  open the cached workspace the same way

Still online when possible
  Licence heartbeat may contact Convex (licence alive)
  Business sales/stock do NOT sync to Convex under local_only
```

| Piece | Where it lives | Purpose |
| --- | --- | --- |
| Convex Auth session | Cloud (when online) | Authoritative identity for first login and staff admin |
| Offline session registry | `localStorage` + `novend-device-auth` Dexie | Resume any staff who signed in on this till (30-day hint freshness) |
| Local password verifier | Device store (`lib/offline/local-auth.ts`) | Offline email/password unlock — digest only, never plaintext |
| Licence snapshot | Dexie `meta` (+ org-scoped localStorage) | Features, limits; `local_only` stays writable offline without a stale write-lock |
| Shell profile | Dexie `meta` | Name, role, branch for UI and sale attribution |

**Gaps vs Chemist:** Chemist keeps users only in Dexie and never needs Convex.
Millie's still needs Convex once to create the org and each staff account. After
that, day-to-day selling and offline re-login work without network. If the offline
session hint ages out (~30 days without an online refresh) or the device is wiped,
staff must sign in online again. New cashiers cannot be created fully offline —
an admin must provision them while online (or already seed a digest on that till).

Key files: `lib/offline/session.ts`, `lib/offline/local-auth.ts`,
`lib/offline/device-auth-store.ts`, `lib/offline/license.ts`,
`features/auth/components/login-form.tsx`.

---

## 6. Data model (mental map)

Business entities the till cares about:

- **Products / categories** — sellable catalog, SKUs, prices, pack/weight/lot flags
- **Stock** — on-hand quantity per product on the store's branch row
- **Sales / sale items / receipts** — immutable completed transactions
- **Till sessions** — local Start today / Close today cash-up (never synced online)
- **Returns** — corrections against completed sales
- **Customers** — optional loyalty / credit where capabilities allow
- **Suppliers / purchases** — receiving stock into the store (no separate wholesale warehouse UI)
- **Users** — staff accounts for this store
- **Settings** — business profile, receipt copy, selling options (supermarket pack)

Convex still holds organization, user, and licence records for bootstrap. Business
operational history for Millie's lives primarily in Dexie on the device.

---

## 7. Repository layout

```text
novend-supermarket/
├── app/                 # Routes (login, dashboard, sales, …) — no marketing site
├── features/            # Feature screens (sales, products, inventory, settings, …)
├── components/          # Shared UI (sidebar, filters, feedback)
├── convex/              # Schema, auth, settings, shared business helpers
├── lib/offline/         # Dexie DB, repositories, licence cache, cloud policy
├── constants/           # APP_NAME, BRANDING, SINGLE_STORE
├── config/              # Navigation (branches/wholesale removed)
├── styles/              # Global tokens (Millie's red/navy)
├── public/branding/     # Logo assets
├── packages/hardware/   # Native bridges
├── apps/desktop/        # Electron
├── apps/mobile/         # Capacitor
└── docs/                # This overview + architecture / design / business docs
```

Feature-first rule: new supermarket UI goes under `features/<feature>/`. Shared
widgets go under `components/`. Business integrity helpers stay in `convex/shared/`
or offline repositories that call them.

---

## 8. Cloud mode (Millie's policy)

| Mode | Millie's behaviour |
| --- | --- |
| `local_only` | Default for new stores. No business outbox flush, no snapshot pull, no cloud backup upload |
| Unknown / missing | Normalized to `local_only` |
| Sync boost | Disabled — never temporarily elevates to `full_sync` |
| Online business write | Dexie only when realtime sync is off (`persistBusinessWrite`) |

Licence heartbeat may still contact Convex when the network is up so the platform
can see that a licensed install is alive. That is not a business-data sync.

Deep dive: [`docs/architecture/OFFLINE_SYNC.md`](./architecture/OFFLINE_SYNC.md).

---

## 8a. Backups and moving to a new till

Because Millie's is `local_only`, **cloud automatic uploads do not run**. Protection
is on-device:

| Kind | Where | Format |
| --- | --- | --- |
| Manual “This device” | Download / Documents | Encrypted `.novend-backup` |
| Automatic folder backup | Chosen folder (desktop) or Documents (mobile) | Same `.novend-backup` |

**Automatic folder backup** (Settings → Backups, admin):

- Interval options match Novend: 12h, 24h, 48h, 7d, 14d, 30d (default 24h).
- Desktop shows the folder path (default `Documents/Millies-Supermarket-Backups`),
  can **Change folder**, **Open**, and **Backup now**.
- Encrypts with the sealed **organization recovery key**.
- Payload is a full Dexie dump (catalog, stock, sales, receipts, customers,
  suppliers, till sessions, settings meta, licence cache, …) so a restore can
  bring a replacement till back to an active store state.

**Import into Novend POS:** open the `.novend-backup` in Novend Settings → Backups
→ Restore, using the same recovery key. Shared tables restore; Millie's-only
tables (e.g. local till sessions) are ignored by Novend.

**Import into a new Millie's install:** install the app → sign in online once for
the same org when possible → Settings → Backups → Restore from file → reload.

Key files: `lib/offline/backup.ts`, `lib/offline/local-folder-backup.ts`,
`features/settings/components/local-folder-backup-panel.tsx`,
`apps/desktop` backup IPC.

---

## 9. Screens cashiers and managers use

| Area | Purpose |
| --- | --- |
| Dashboard | Today’s pulse for the store |
| Sales (POS) | Checkout |
| Orders | Recent / held / completed sales list |
| Returns | Process returns |
| Customers | Customer records |
| Products | Catalog |
| Inventory | Stock levels and adjustments |
| Suppliers | Receiving / supplier records |
| Analytics / Reports | Oversight (role-gated) |
| Users | Staff accounts (admin/manager) |
| Settings | Store profile, selling options, devices, backups, About |

Explicitly **not** in nav: Branches, Wholesale, Floor/Kitchen/Rooms (other industries),
marketing pages, public legal pages.

---

## 10. Develop and run

```bash
cd D:\dev\software\novend-supermarket
pnpm install
pnpm dev:all          # Next.js + Convex
pnpm test             # Vitest
pnpm desktop:dev      # Electron shell
```

First Convex deployment still needs project env (`NEXT_PUBLIC_CONVEX_URL`, auth
keys) like Novend. After the store is provisioned as `local_only`, day-to-day
selling is local-first.

---

## 11. Related docs

| Doc | Use |
| --- | --- |
| [`MILLIES_OVERVIEW.md`](./MILLIES_OVERVIEW.md) | This product overview (start here) |
| [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) | Short product context for Millie's |
| [`PROJECT_CONSTITUTION.md`](./PROJECT_CONSTITUTION.md) | Engineering authority (inherited from Novend shape) |
| [`FOLDER_STRUCTURE.md`](./FOLDER_STRUCTURE.md) | Where code belongs |
| [`architecture/OFFLINE_SYNC.md`](./architecture/OFFLINE_SYNC.md) | Dexie / local_only detail |
| [`design/branding/colors.md`](./design/branding/colors.md) | Logo-derived palette |
| [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md) | Scripts and engineering entry |

---

## 12. Success criteria

- A cashier can complete a sale with or without network after first activation.
- Inventory never goes negative; every stock change has a reason.
- Completed sales are immutable; corrections go through returns.
- The UI looks like Millie's (logo, red, navy) — not Novend marketing teal.
- Branches and wholesale management are unreachable.
- The only Novend branding on receipts is `Powered by Novend POS`.
