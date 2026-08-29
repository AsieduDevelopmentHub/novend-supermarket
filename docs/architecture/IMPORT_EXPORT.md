# Product Import, Export & Plan Entitlements

Version: 1.1.1

Architecture for catalog import, reusable export, and plan-gated formats.
Business rules stay in Convex. Dexie remains the operational replica.

## 1. Current product schema

`products` (`convex/schema.ts`) currently stores:

- `organizationId`, `name`, `sku`, `barcode?`, `categoryId`
- `costPrice`, `sellingPrice`, `stockQuantity`, `unit`, `lowStockThreshold`
- `tracksExpiry?`, `expiryAlertDays?`, `status`, `description?`, `imageStorageId?`

Opening stock on a **new** product that tracks expiry also needs an expiry date
(`YYYY-MM-DD`) so Convex can create the first lot. Import validates that before
writing Dexie.

On-hand quantity also lives on `branchStock` (per branch). Convex `_creationTime`
exists; there is no product `updatedAt`, brand, wholesale price, tax, or supplier
foreign key on the catalog row.

Import and export use **only these fields**. Unmapped client columns (brand,
supplier, tax) are skipped with an explanation, not invented.

## 2. Current import / export

- **Import:** none. Catalog writes go through `createProduct` / `updateProduct`
  and the Dexie outbox (`upsert_product`, `create_category`).
- **Export:** `services.exportCsv` is a thin CSV download. Products exported
  name / SKU / stock only. Analytics built an ad-hoc CSV and print HTML.
  `jspdf` is already a dependency. No shared format adapters.

## 3. Current reporting / analytics

- Reports: `reports.salesSummary` plus Dexie `buildLocalSalesReport`.
- Analytics: `analytics.summary` plus `useOfflineAnalytics`.
- Both already honor organization, branch filter, and date range. Managers are
  branch-scoped via `resolveBranchFilter`.

## 4. Current SaaS plan / entitlements

`convex/shared/plans.ts` is the catalog. Limits: products, users, branches,
devices, backupBytes (`null` = unlimited).

| Plan       | Products | Notes                                      |
| ---------- | -------- | ------------------------------------------ |
| Basic      | 500      | Reports + analytics in the feature list    |
| Pro        | 5,000    | Adds “Advanced analytics”                  |
| Enterprise | unlimited | Everything in Pro                         |
| Lifetime   | unlimited | Everything in Enterprise                  |

`assertOrganizationCapacity` already gates product creates. No import/export
capability object existed; UI must not scatter `if (plan === "pro")`.

## 5. Organization / RBAC

Every catalog write resolves org from the session profile. Administrators and
managers may import/export catalog (cost prices only if `canViewCostPrice`).
Cashiers must not import or see cost in exports. Platform admins without a
tenant role never run tenant import/export.

## 6. IndexedDB / offline

Dexie + outbox. Product creates/updates already queue `upsert_product`. Imports
write locally, then drain. Exports of on-device lists and reports run offline.
Job history and mapping sync to Convex when online.

## 7. Gaps and risks

- Thin product CSV; no mapping engine; no file/row guards; CSV formula injection.
- Plan format gates (XLSX/PDF) were undefined.
- Opening stock on **update** must not silently rewrite inventory (immutable
  history). Quantity applies on **create** only; updates skip quantity.
- Large PDFs on the client; cap PDF row count.
- Malformed xlsx/zip bombs: size, row, and unzip limits.

## 8. Proposed reusable architecture

```text
File / report source
        ↓
lib/import  (parse → map → validate → preview)
lib/export  (definition → scope → CSV | XLSX | PDF | JSON)
        ↓
convex/shared/capabilities.ts   (derived from the plan catalog)
        ↓
UI: Import wizard + Export menu
        ↓
Dexie replica + outbox → Convex createProduct / updateProduct
```

Capabilities (not raw plan keys in UI):

- `canImportProducts`, `canExportReports`, `canExportCsv/Json`
- `canExportXlsx`, `canExportPdf`, `canAdvancedAnalytics` — Pro rank and above
  (sortOrder ≥ Pro), matching “Advanced analytics”
- `maxImportRows` — derived from `limits.products`, capped at a safety maximum
  (10,000). Not a separately priced quota. Super Admin product-limit overrides
  change this cap for that organization only.
- Product **count** remains the billed usage metric. Import/export **events**
  are recorded for Super Admin visibility, not as a billed `maxExportsPerPeriod`.

## 9. Super Admin visibility

Platform administrators (`requirePlatformAdmin`) see:

| Surface | What is shown |
| --- | --- |
| Platform overview | Platform-wide job/export counts, format mix, CSV-only tenant count, organizations at ≥80% of their product/import cap |
| Organizations list | Per-org import jobs, failed jobs, export events, import row cap, Excel/PDF entitlement, product override flag |
| Organization overview & licence | Derived capabilities, product used vs limit, remaining creates, recent jobs (filename + counts), recent exports, audited limit-override history |

Privacy: counts, filenames, formats, and row totals only. Spreadsheet contents are never stored. Platform admins without a tenant role still cannot run tenant import/export mutations.

Excel/PDF follow plan rank (Pro and above). Changing a product override does **not** unlock those formats.

Platform monitoring reports are a separate Super Admin capability. They bypass
tenant plan gates, contain only platform-safe aggregates, and are audit
recorded. The executive PDF is presentation-oriented; the XLSX workbook uses
separate summary, trend, runtime, adoption, release, operations, and
organization sheets; CSV provides a portable executive KPI dataset.

## 10. Implementation phases

1. Capabilities on the licence snapshot.
2. Import engine (CSV/TSV/XLSX/SpreadsheetML) + mapping + validation.
3. Shared export adapters + comprehensive product export.
4. Reports and analytics wired to the same menu.
5. Import wizard, job history, mapping templates, tests, docs.

## 11. Tests required

- Header synonym mapping and uncertain (unmapped) headers
- Validation: missing required fields, duplicate SKU/barcode in file, money/qty
- Formula-injection prefix on CSV/XLSX cells
- Capability derivation from catalog plans (no invented prices)
- File type/size/row rejection
- Export filenames remain branded
