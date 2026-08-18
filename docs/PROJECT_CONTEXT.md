# Novend POS

## Project Context

Version: 1.0.0

# Purpose

Operational and product context for Novend POS. Read alongside the Constitution.

# Product

**Brand:** Novend (Nova + Vend)
**Developer:** Asiedu Development Hub
**Type:** Commercial SaaS / deployable POS, inventory, and business management

Novend is the commercial evolution of Princellen POS: one codebase serving many
independent businesses rather than one dedicated wholesaler.

# Who it is for

Retail shops, wholesale distributors, pharmacies, electronics, fashion, hardware,
convenience stores, and other product-based businesses — including multi-branch
organizations.

# What this slice delivers

A new customer can:

1. Create an account
2. Create their business (organization + MAIN branch)
3. Add staff
4. Add categories and products
5. Receive / adjust stock
6. Sell at the POS
7. Print a receipt
8. Complete a sale while offline (after an online login), then sync

# What this slice does not deliver

Returns, multi-branch UI, stock transfers, suppliers, purchases, expenses, full
reports/analytics, Electron desktop, billing, industry modules.

# Stakeholders

| Role | Need |
|------|------|
| Organization owner | Bootstrap the business, manage staff and settings |
| Administrator / manager | Catalog, inventory, oversight |
| Cashier | Fast, reliable selling |
| Engineer | Clear architecture, tenant isolation, documented rules |

# Deployment targets

- **Web** — primary for this slice (browsers, tablets)
- **PWA** — installable; service worker for offline shell
- **Desktop (Electron)** — documented, not built in this slice

# Success for the business

Two organizations on one Convex deployment cannot see each other’s data.
A cashier can complete a sale online and offline. Inventory never goes negative.
The UI feels like Princellen’s density with Novend branding.
