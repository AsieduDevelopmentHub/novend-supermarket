# UI screenshots

Product captures used in GitHub docs, the marketing site (`/docs`, landing), and
design review. Prefer these paths in Markdown so images render on GitHub.

```text
docs/design/ui/<file>
```

## Marketing & devices

| File | Shows |
|------|--------|
| `novend_Landing_full_screen.png` | Public landing page |
| `desktop_fullpage.png` | Desktop / wide POS shell |
| `mobile_fullpage.png` | Phone-sized web layout |
| `hero-shell-empty-no-bg.png` | Marketing hero device shell |
| `ui_reference.png` | Design reference board |

## Auth & setup

| File | Shows |
|------|--------|
| `auth-signup.png` | Create account |
| `auth-login.png` | Sign in |
| `business-onboarding.png` | Create organization / business |
| `dashboard.png` | Post-setup dashboard |

## Sales

| File | Shows |
|------|--------|
| `sales-pos.jpg` / `sales-pos.png` | Checkout (product grid + cart) |
| `sales-pos-receipt-modal.png` | Receipt after pay |
| `sales-orders.png` | Orders list |
| `sales-order-detail.png` | Order detail |
| `sales-returns.png` / `sales-return-detail.png` | Returns |
| `sales-customer-detail.png` | Customer profile |

Industry-flavored POS: `sale-pharmacy.jpg`, `sale-supermarket.jpg`,
`sale-wholesale.jpg`, `sale-fashion.jpg`, `sale-electronics.jpg`,
`sale-convenience.jpg`.

## Inventory & wholesale

| File | Shows |
|------|--------|
| `inventory-products.png` | Product catalog |
| `inventory-stock.png` | Branch stock |
| `inventory-wholesale.png` | Wholesale warehouse |
| `inventory-suppliers.png` | Suppliers |
| `inventory-*-modal.png` | Adjust, transfer, receive, issue |

## Analytics, admin & settings

| File | Shows |
|------|--------|
| `business-analytics-*.png` | Analytics & P&L |
| `business-reports*.png` | Reports |
| `administration-*.png` | Users & branches |
| `settings-*.png` | Profile, billing, hardware, devices, sync backup |
| `sync-recent.png` | Recent sync activity |

## Using images in Markdown

```md
![Sales POS](docs/design/ui/sales-pos.jpg)
```

From a file under `docs/business/`:

```md
![Sales POS](../design/ui/sales-pos.jpg)
```
