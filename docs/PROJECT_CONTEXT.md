# Millie's Supermarket POS

## Project Context

Version: 2.0.0

# Purpose

Operational and product context for **Millie's Supermarket POS**. Full stack and
workflow overview: [`MILLIES_OVERVIEW.md`](./MILLIES_OVERVIEW.md).

# Product

**Brand:** Millie's Supermarket  
**Engine lineage:** Novend POS (cloned and specialized)  
**Vendor credit on receipts only:** `Powered by Novend POS`  
**Type:** Single-store supermarket Point of Sale (local-first)

This repository is not the multi-industry Novend SaaS website. There is no public
marketing or legal site. `/` sends staff to sign-in.

# Who it is for

Millie's supermarket cashiers, managers, and administrators on one store.

# What staff can do

1. Sign in (first time online) and set up the store — later offline re-login uses a
   device password verifier; see [`MILLIES_OVERVIEW.md`](./MILLIES_OVERVIEW.md) §5
2. Add categories, products, and stock
3. Receive goods via suppliers / inventory
4. Sell at the POS (packs, lots/expiry, sell-by-weight as configured)
5. Print or share a receipt
6. Keep selling offline after first activation — business data stays on the till
7. Process returns, review orders, customers, and reports (by role)
8. Admins: encrypted folder auto-backup (Novend-compatible `.novend-backup`) for
   recovery on a new till

# What is out of scope

- Multi-branch management UI
- Wholesale warehouse UI
- Hotel / restaurant / pharmacy industry packs
- Live cloud sync of sales and stock between tills
- Public marketing, pricing, or legal pages

# Stakeholders

| Role | Need |
| --- | --- |
| Store owner / admin | Bootstrap store, staff, settings |
| Manager | Catalog, inventory, oversight |
| Cashier | Fast, reliable selling |
| Engineer | Clear architecture, local integrity, Millie's branding |

# Deployment targets

- **Web** — browsers and tablets
- **PWA** — offline shell via service worker
- **Desktop (Electron)** — installers under `apps/desktop`
- **Android (Capacitor)** — shell under `apps/mobile`

# Brand

| Token | Value |
| --- | --- |
| Name | Millie's Supermarket |
| Red | `#ED0206` |
| Navy | `#012561` |
| Logo | `docs/design/branding/milliesmart.png` |

See [`design/branding/colors.md`](./design/branding/colors.md).

# Success for the store

A cashier completes sales online and offline. Inventory never goes negative.
The UI is Millie's red and navy with the Millie's logo. Business data for the
day lives on the till. Encrypted backups can rebuild the store on new hardware.
Receipts end with `Powered by Novend POS`.
