# Novend POS

Commercial offline-first Point of Sale and business management platform
(**Nova + Vend**). Multi-tenant POS for independent retail, wholesale, pharmacy,
fashion, electronics, and convenience businesses.

Built by [Asiedu Development Hub](https://github.com/asiedudev).

<p align="center">
  <img src="docs/design/ui/desktop_fullpage.png" alt="Novend marketing landing page" width="920" />
</p>

See [`overview.md`](./overview.md) for product vision and
[`docs/PROJECT_CONSTITUTION.md`](./docs/PROJECT_CONSTITUTION.md) for engineering
authority. Public product docs (with interactive screenshots) live at `/docs` in
the running app.

## Product tour

| App dashboard | Mobile / tablet web |
|-------------|---------------------|
| <img src="docs/design/ui/dashboard.png" alt="Novend dashboard" width="440" /> | <img src="docs/design/ui/mobile_fullpage.png" alt="Novend on a phone" width="220" /> |

### Get started

| Sign up | Onboarding | Dashboard |
|---------|------------|-----------|
| <img src="docs/design/ui/auth-signup.png" alt="Create account" width="280" /> | <img src="docs/design/ui/business-onboarding.png" alt="Create your business" width="280" /> | <img src="docs/design/ui/dashboard.png" alt="Dashboard overview" width="280" /> |

### Sell & manage stock

<p align="center">
  <img src="docs/design/ui/sales-pos.jpg" alt="Sales POS checkout" width="920" />
</p>

| Inventory | Wholesale | Analytics |
|-----------|-----------|-----------|
| <img src="docs/design/ui/inventory-stock.png" alt="Branch stock" width="280" /> | <img src="docs/design/ui/inventory-wholesale.png" alt="Wholesale warehouse" width="280" /> | <img src="docs/design/ui/business-analytics-overview.png" alt="Analytics overview" width="280" /> |

### Built for every kind of retail

| Pharmacy | Supermarket | Wholesale |
|----------|-------------|-----------|
| <img src="docs/design/ui/sale-pharmacy.jpg" alt="Pharmacy POS" width="280" /> | <img src="docs/design/ui/sale-supermarket.jpg" alt="Supermarket POS" width="280" /> | <img src="docs/design/ui/sale-wholesale.jpg" alt="Wholesale POS" width="280" /> |

| Fashion | Electronics | Convenience |
|---------|-------------|-------------|
| <img src="docs/design/ui/sale-fashion.jpg" alt="Fashion POS" width="280" /> | <img src="docs/design/ui/sale-electronics.jpg" alt="Electronics POS" width="280" /> | <img src="docs/design/ui/sale-convenience.jpg" alt="Convenience POS" width="280" /> |

More UI captures: [`docs/design/ui/README.md`](./docs/design/ui/README.md).

## What you get

- Offline-first checkout with cloud sync when the network returns
- Inventory, wholesale storage, branch transfers, and adjustments with history
- Customers, suppliers, returns, analytics, and printable reports
- Desktop installers (Windows / macOS / Linux) plus web — mobile apps on the roadmap
- Roles for cashier, manager, administrator, and owner — always organization-scoped

## Stack

Next.js · Convex · TypeScript · Tailwind CSS · Dexie · pnpm

## Develop

```bash
pnpm install
npx convex dev
pnpm dev
```

Copy `.env.example` to `.env.local`. Convex codegen (`convex/_generated`) is
refreshed by `npx convex dev`.

First-time flow: **sign up → onboard your business → add products → sell**.

## Documentation map

| Doc | Purpose |
|-----|---------|
| [`docs/PROJECT_CONSTITUTION.md`](./docs/PROJECT_CONSTITUTION.md) | Engineering authority |
| [`docs/PROJECT_CONTEXT.md`](./docs/PROJECT_CONTEXT.md) | Product context |
| [`docs/FOLDER_STRUCTURE.md`](./docs/FOLDER_STRUCTURE.md) | Code ownership |
| [`docs/business/SALES_WORKFLOW.md`](./docs/business/SALES_WORKFLOW.md) | POS sell flow |
| [`docs/business/INVENTORY_WORKFLOW.md`](./docs/business/INVENTORY_WORKFLOW.md) | Stock movements |
| [`docs/architecture/OFFLINE_SYNC.md`](./docs/architecture/OFFLINE_SYNC.md) | Local-first sync |
| [`docs/design/ui/README.md`](./docs/design/ui/README.md) | Screenshot index |
