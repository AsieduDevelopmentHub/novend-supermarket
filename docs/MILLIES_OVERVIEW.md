# Millie's Supermarket POS — Full Overview

Version: 1.1.0

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
- **Fully offline operation** — zero network required after install
- One physical store — not multi-branch, not wholesale warehouse, not hotel/restaurant

It is **not**:

- A public marketing website
- A multi-industry SaaS for many unrelated shops choosing packs at signup
- A live multi-till cloud stock sync product (each till keeps its own Dexie database)
- A cloud-licensed / Convex-dependent till (Convex code may remain in the tree but is **not used** at runtime)

---

## 2. Stack

| Layer | Technology | Role |
| --- | --- | --- |
| UI | Next.js App Router (TypeScript), React | Screens, routing, layouts |
| Styling | Tailwind CSS v4 + CSS tokens | Millie's red / navy theme |
| Auth & users | Dexie `millies-auth-v1` + PBKDF2 | Local staff accounts (Chemist-style) |
| Local business data | Dexie (IndexedDB) | Sales, products, stock, customers on this till |
| Licence | Perpetual local snapshot in Dexie | `local_only` / lifetime — always writable after setup |
| Package manager | pnpm (workspace) | App + `packages/hardware` + desktop/mobile shells |
| Desktop shell | Electron (`apps/desktop`) | Windows/macOS/Linux wrapper around the app |
| Mobile shell | Capacitor (`apps/mobile`) | Android wrapper around the app |
| Hardware | `@novend/hardware` | Print, biometrics, share, filesystem bridges |
| Printing | ESC/POS + browser print | Receipts |
| Tests | Vitest | Contract and unit tests under `tests/` |

```text
Browser / Electron / Capacitor
        │
        ▼
Next.js UI (features/, components/, app/)
        │
        ▼
Dexie (IndexedDB)  ← sole authority for auth + business data
```

### How the layers divide responsibility

- **UI** paints and collects input. It never decides inventory or sale integrity alone.
- **Dexie** is the **source of truth**. Auth users, completed sales, stock, catalog,
  and customers live here.
- **Convex** may remain in the repository for shared validators / future use. Runtime
  Millie's sets `FULLY_OFFLINE = true` and never requires `NEXT_PUBLIC_CONVEX_URL`.
- **Shared validators** under `convex/shared/` still encode business rules
  (non-negative stock, immutable sales, capability checks). Offline repositories
  reuse those helpers.

Flag: `constants/runtime.ts` → `FULLY_OFFLINE`.

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

### First-time setup (no network)

1. Staff open the app (web, desktop, or mobile shell) with **no** Convex URL required.
2. Setup wizard creates the admin username/password (PBKDF2), seals a recovery key,
   seeds a perpetual local licence, and binds the synthetic org/branch IDs.
3. Admin adds products, categories, and opening stock — all in Dexie.

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

- **Till is Dexie-only** — Start today / Close today never call the network.
- If the cashier has not started, the **first completed sale auto-starts** today
  with opening float `0`.
- Held carts do not reduce stock until checkout completes.
- Returns use return workflows; completed sales are not edited.
- Cashiers cannot reach catalog, pricing, or settings that belong to admin/manager.
- Closed till sessions appear on **Reports** and **Analytics**.

### Offline selling

Airplane mode for the entire life of the install is supported: setup → login →
catalog → Start today → sale → backup.

### Multi-device reality

Each installation has its own IndexedDB. Two tills do **not** share live stock
in real time. Move a store to a new PC/tablet by restoring an encrypted backup
(see §8a).

---

## 5. Authentication and roles

| Role | Typical access |
| --- | --- |
| Cashier | Sales, hold/resume, orders list, returns (as permitted), customers, reports they are allowed |
| Manager | Catalog/inventory ops, suppliers, analytics/reports, cashiers |
| Administrator | Users, settings, backups, full store configuration |

Permissions come from the **local session** (Dexie `localUsers` + shell profile).
There is no Convex Auth JWT.

### How accounts and sign-in work

Millie's matches **Chemist-style local authority**: Dexie users + PBKDF2 are the
only identity store.

```text
First boot
  Setup wizard → create admin (PBKDF2) → show recovery key once
       → perpetual local licence snapshot
       → synthetic org/branch bind
       → session in sessionStorage + millies_local_session cookie

Later
  /login → username + password against localUsers
       → session + shell profile → /sales
  Users UI → admin/manager create cashiers in Dexie (no cloud)
```

| Piece | Where it lives | Purpose |
| --- | --- | --- |
| Local users | `millies-auth-v1` Dexie (`localUsers`) | Username, role, PBKDF2 salt/hash |
| Local session | `sessionStorage` + cookie | Shell unlock (no cloud refresh expiry) |
| Recovery key | Sealed on device | Encrypt `.novend-backup` files |
| Licence snapshot | Dexie `meta` (+ org localStorage) | Perpetual `local_only` / lifetime write access |
| Shell profile | Dexie org replica `meta` | Name, role, branch for UI and sale attribution |
| Business replica | `novend-offline-millies-local` | **Shared** catalog, stock, sales for all staff on this till |

Unlike SaaS Novend (per-user replicas), Millie's binds one org Dexie for every
cashier so products and stock stay consistent after staff switch. Legacy
per-user DBs are migrated once via `lib/offline/millies-shared-replica.ts`.

Key files: `constants/runtime.ts`, `lib/offline/millies-auth.ts`,
`lib/offline/millies-auth-db.ts`, `lib/offline/millies-bootstrap.ts`,
`lib/offline/millies-shared-replica.ts`,
`features/auth/components/millies-setup-wizard.tsx`,
`features/auth/components/millies-login-form.tsx`,
`features/users/components/millies-users-view.tsx`.

---

## 6. Data model (mental map)

Business entities the till cares about:

- **Products / categories** — sellable catalog, SKUs, prices, pack/weight/lot flags
- **Stock** — on-hand quantity per product on the store's branch row
- **Sales / sale items / receipts** — immutable completed transactions
- **Till sessions** — local Start today / Close today cash-up
- **Returns** — corrections against completed sales
- **Customers** — optional loyalty / credit where capabilities allow
- **Suppliers / purchases** — receiving stock into the store
- **Users** — local staff accounts (`localUsers`)
- **Settings** — business profile, receipt copy, selling options (supermarket pack)

---

## 7. Repository layout

```text
novend-supermarket/
├── app/                 # Routes (login, dashboard, sales, …) — no marketing site
├── features/            # Feature screens (sales, products, inventory, settings, …)
├── components/          # Shared UI (sidebar, filters, feedback)
├── convex/              # Shared validators (not called at Millie's runtime)
├── lib/offline/         # Dexie DB, repositories, local auth, licence, backups
├── constants/           # APP_NAME, BRANDING, SINGLE_STORE, FULLY_OFFLINE
├── config/              # Navigation (branches/wholesale removed)
├── styles/              # Global tokens (Millie's red/navy)
├── public/branding/     # Logo assets
├── packages/hardware/   # Native bridges
├── apps/desktop/        # Electron
├── apps/mobile/         # Capacitor
└── docs/                # This overview + architecture / design / business docs
```

---

## 8. Cloud mode (Millie's policy)

| Mode | Millie's behaviour |
| --- | --- |
| `local_only` | Always. No Convex business API, no outbox flush, no snapshot pull, no cloud backup |
| Billing / devices UI | Hidden |
| Sync boost | N/A |

Deep dive on Dexie patterns: [`docs/architecture/OFFLINE_SYNC.md`](./architecture/OFFLINE_SYNC.md)
(Novend-shaped docs; Millie's runtime is stricter — fully offline).

---

## 8a. Backups and moving to a new till

**Cloud automatic uploads do not run.** Protection is on-device:

| Kind | Where | Format |
| --- | --- | --- |
| Manual “This device” | Download / Documents | Encrypted `.novend-backup` |
| Automatic folder backup | Chosen folder (desktop) or Documents (mobile) | Same `.novend-backup` |

**Automatic folder backup** (Settings → Backups, admin):

- Interval options: 12h, 24h, 48h, 7d, 14d, 30d (default 24h).
- Desktop shows the folder path (default `Documents/Millies-Supermarket-Backups`),
  can **Change folder**, **Open**, and **Backup now**.
- Encrypts with the sealed **recovery key** from setup.
- Payload is a full Dexie dump so a restore can bring a replacement till back.

**Import into Novend POS:** open the `.novend-backup` in Novend Settings → Backups
→ Restore, using the same recovery key.

**Import into a new Millie's install:** install → complete or skip to restore →
Settings → Backups → Restore from file → reload. Local users and licence return
with the backup when included in the dump.

Key files: `lib/offline/backup.ts`, `lib/offline/local-folder-backup.ts`,
`features/settings/components/local-folder-backup-panel.tsx`.

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
| Users | Local staff accounts (admin/manager) |
| Settings | Store profile, selling options, local backups, About |

Explicitly **not** in nav: Branches, Wholesale, Billing, cloud device activation,
Floor/Kitchen/Rooms, marketing pages.

---

## 10. Develop and run

```bash
cd D:\dev\software\novend-supermarket
pnpm install
pnpm dev              # Next.js only — no Convex required
pnpm test             # Vitest
pnpm desktop:dev      # Electron shell
```

`NEXT_PUBLIC_CONVEX_URL` is optional and unused when `FULLY_OFFLINE` is true.

---

## 11. Related docs

| Doc | Use |
| --- | --- |
| [`MILLIES_OVERVIEW.md`](./MILLIES_OVERVIEW.md) | This product overview (start here) |
| [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) | Short product context for Millie's |
| [`PROJECT_CONSTITUTION.md`](./PROJECT_CONSTITUTION.md) | Engineering authority |
| [`FOLDER_STRUCTURE.md`](./FOLDER_STRUCTURE.md) | Where code belongs |
| [`architecture/OFFLINE_SYNC.md`](./architecture/OFFLINE_SYNC.md) | Dexie patterns (Novend-shaped) |
| [`design/branding/colors.md`](./design/branding/colors.md) | Logo-derived palette |
| [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md) | Scripts and engineering entry |

---

## 12. Success criteria

- Fresh install with **no** Convex URL → setup wizard → sell a product offline.
- Sign out → login with local admin/cashier passwords.
- Create cashier in Users → login as cashier → Start today / sale.
- Folder backup → restore on second profile → store active again.
- Airplane mode through the entire flow.
- Inventory never goes negative; every stock change has a reason.
- Completed sales are immutable; corrections go through returns.
- The UI looks like Millie's (logo, red, navy).
- The only Novend branding on receipts is `Powered by Novend POS`.
