# Sample data → Go live (Millie's)

First-boot setup can load a supermarket sample pack (`Load sample data`): sample categories, products with stock, and a few demo sales.

## Status

Auth meta `sampleDataStatus`: `none` | `active` | `cleared`.

## Go live

Settings → Business → **Go live** (banner links here while samples are active). Administrators only.

- **Remove sample data** — deletes `isSample` products, categories, and demo orders (plus related stock/lots/order items).
- **Clear all operational data** — clears business Dexie tables; keeps local users and auth/settings meta. Type `CLEAR` to confirm.

After Go live, status is `cleared`.
