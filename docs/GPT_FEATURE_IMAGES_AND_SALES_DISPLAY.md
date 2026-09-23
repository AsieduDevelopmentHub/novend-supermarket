# Product Images Policy & Sales Display Preferences

Implementation date: 2026-09-23  
Source: [`gpt.md`](./gpt.md) (Final Feature Implementation and Release)

## Feature 1 — Product-image controls

| Piece | Implementation |
|-------|----------------|
| Policy storage | Settings key `catalog.productImages` → `{ enabled: boolean }`, default `true` |
| Org admin | `settings.getProductImages` / `settings.updateProductImages` |
| Platform admin | `platform.setProductImagesEnabled` |
| Enforcement | `products.generateUploadUrl`, `createProduct`, `updateProduct` reject new `imageStorageId` when disabled; `clearImage` still allowed |
| Offline | Snapshot + Dexie `productImagesPolicy`; `queueUpsertProduct` refuses new blobs; existing images still display |
| Audit | `update_product_images_policy`, `platform_set_product_images_policy` |
| UI | Settings → Business card; Platform org Licence toggle; product form hides Upload/Camera |

## Feature 2 — Sales product-display preferences

| Piece | Implementation |
|-------|----------------|
| Modes | `list`, `grid` (default), `icons`, `cards`, `dense` |
| Columns | Optional 2–5 for grid-like modes; responsive `minmax` prevents crushing |
| Local | `novend.sales.productDisplay.<userId>` |
| Sync | Optional `profiles.salesProductDisplay` + `users.updateOwnSalesProductDisplay` |
| UI | Toolbar next to Sales search; catalog extracted to `sales-product-catalog.tsx` |

## Verification

- Focused Vitest suites for policy, offline refusal, and display prefs
- Full `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` before release PR
- Manual: org/platform toggles, offline policy, Sales view modes on web/narrow widths

## Release

Follow git workflow: commit → push `staging` → PR `staging` → `main`.
