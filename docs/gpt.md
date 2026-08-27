## Novend — Product Import, Reporting, Export & SaaS Plan Architecture

I want to introduce a major architectural expansion to Novend covering **product imports, detailed reporting, analytics exports, comprehensive product exports, and SaaS plan-based access/limits**.

Do not implement this as isolated UI features. Design and implement a reusable architecture that can scale across organizations, plans, Web/PWA, Electron, and Capacitor.

### 1. Product Import System

Clients must be able to import existing products into Novend.

Support two import approaches:

#### A. Novend Template Import

Provide an official downloadable product-import template containing Novend's supported fields.

The client fills in the template and uploads it.

The system should:

* Detect headers.
* Validate required fields.
* Validate data types and formats.
* Detect duplicate products/SKUs/barcodes where applicable.
* Show validation errors before committing data.
* Provide an import preview.
* Show how many records will be created/updated/skipped.
* Allow the client to confirm the import.
* Process large imports safely.
* Provide an import result/history after completion.

#### B. Dynamic Header Mapping

Clients often have completely different spreadsheets and naming conventions.

Do not assume their headers match Novend.

For example:

```text
Client spreadsheet:

Item Name
Product Code
Selling Price
Cost
Qty
Barcode No
Supplier Name
```

Novend expects:

```text
Product Name
SKU
Selling Price
Cost Price
Quantity
Barcode
Supplier
```

The import system should intelligently identify likely matches using normalized names and keyword/synonym matching.

Examples:

```text
Item Name → Product Name
Product → Product Name
Product Title → Product Name

Product Code → SKU
Item Code → SKU
Stock Code → SKU

Barcode No → Barcode
EAN → Barcode
UPC → Barcode
```

Do not rely solely on exact string matching.

### Manual Mapping

If automatic mapping is uncertain, allow the user to manually map:

```text
Client Header       Novend Field
----------------------------------
Item Name      →    Product Name
Product Code   →    SKU
Selling Price  →    Selling Price
Qty            →    Quantity
Barcode No     →    Barcode
```

The user should be able to save/reuse mapping templates for future imports.

### Import Pipeline

Use a staged architecture:

```text
Upload
  ↓
File validation
  ↓
Header detection
  ↓
Automatic mapping
  ↓
Manual correction
  ↓
Preview
  ↓
Validation
  ↓
Import job
  ↓
Database write
  ↓
Local IndexedDB update
  ↓
Sync/outbox where required
  ↓
Import report
```

Do not partially corrupt the product database if an import fails.

---

# 2. Supported Import Formats

Design the import engine so it can support:

* CSV
* XLSX
* XLS where practical
* Future formats without rewriting the import architecture

Keep the parser/mapping/validation layers independent from the UI.

---

# 3. Product Export Must Be Comprehensive

The current product export appears to contain only a few columns.

That is not sufficient for a SaaS/POS system where the product model contains significantly more information.

Audit the actual product schema and create a comprehensive export containing all appropriate product information, such as:

* Product ID
* Product name
* SKU
* Barcode
* Category
* Brand
* Description
* Cost price
* Selling price
* Wholesale price where applicable
* Tax information
* Stock quantity
* Minimum stock
* Unit
* Supplier
* Branch
* Status
* Product image/reference where appropriate
* Created date
* Updated date
* Other relevant product fields actually present in the schema

Do NOT invent fields that do not exist.

Export should be based on the actual current schema.

Support:

* CSV
* XLSX
* PDF where appropriate
* Other formats only where they provide meaningful value

For very large datasets, avoid generating huge client-side PDFs unnecessarily.

---

# 4. Reports & Analytics Export System

Introduce a reusable export architecture for reports and analytics.

Users should be able to export relevant reports as:

* PDF
* Excel/XLSX
* CSV
* JSON where useful
* Other appropriate formats

The export system should preserve the report's actual data rather than exporting only the visible UI cards.

For example, analytics may contain:

* Revenue
* Sales
* Profit
* Returns
* Expenses
* Purchases
* Inventory
* Product performance
* Customer performance
* Branch performance
* Tax
* Payment methods
* Trends
* Date ranges
* Comparative periods

Export should respect the currently selected:

* Organization
* Branch
* Date range
* Filters
* User permissions

Never export information outside the user's authorized organization/branch scope.

---

# 5. Reusable Export Architecture

Do not create separate export implementations for every page.

Create a shared export layer conceptually:

```text
Report/Data Source
       ↓
Export Definition
       ↓
Permission + Scope Validation
       ↓
Data Preparation
       ↓
Format Renderer
   ┌───┼────┬────┐
   ↓   ↓    ↓    ↓
 CSV XLSX  PDF  JSON
```

This should be reusable by:

* Products
* Sales
* Orders
* Returns
* Inventory
* Purchases
* Customers
* Suppliers
* Expenses
* Reports
* Analytics
* Platform/Super Admin reports where applicable

---

# 6. SaaS Plan Access & Limits

This entire update must integrate with the existing Novend SaaS subscription architecture.

Every new capability must have a clearly defined plan entitlement.

Do NOT hardcode plan checks throughout the UI.

Create/reuse a centralized entitlement system:

```text
Organization
    ↓
Current Plan
    ↓
Entitlements
    ↓
Feature Access + Usage Limits
```

The entitlement system should support both:

### Feature access

Example:

```text
canImportProducts
canExportReports
canExportPDF
canExportXLSX
canExportCSV
canAdvancedAnalytics
```

### Usage limits

Example:

```text
maxProducts
maxUsers
maxDevices
maxCloudStorage
maxImportRows
maxExportsPerPeriod
```

Use the actual current Novend plan definitions from the codebase rather than inventing new pricing/limits.

---

# 7. Plan Enforcement

Plan restrictions must be enforced server-side/backend-side, not only through hidden UI buttons.

The UI should still communicate limits clearly.

Example:

```text
Basic
Product limit: 200 / 200

Import unavailable because the product limit has been reached.
Upgrade to continue.
```

Another example:

```text
Export limit
23 / 25 exports used this period
```

Where a feature is not available:

* Clearly show it as restricted.
* Explain why.
* Provide an upgrade path where appropriate.
* Do not expose internal/developer errors.

Never rely solely on:

```text
if (plan === "pro")
```

throughout the frontend.

Use centralized entitlement checks.

---

# 8. SaaS Usage Tracking

Introduce reusable usage tracking for features that need quotas.

For example:

```text
organization
    ↓
usage
 ├── products
 ├── users
 ├── devices
 ├── storage
 ├── imports
 └── exports
```

Usage must be organization-scoped.

Prevent one organization from affecting another organization's usage.

Where appropriate, usage should be calculated from authoritative backend data rather than trusting client-provided counters.

---

# 9. Import/Export Security

Treat uploaded spreadsheets and generated exports as untrusted/sensitive data.

Implement:

* File type validation
* File size limits
* Row limits based on plan
* Input validation
* Sanitization
* Formula-injection protection for spreadsheet exports
* Authorization checks
* Organization/branch scoping
* Safe image/file handling
* Protection against malformed spreadsheets

Never allow imported data to bypass existing RBAC or organization isolation.

---

# 10. Offline-First Compatibility

Novend remains offline-first.

Where appropriate:

```text
Local IndexedDB
      ↓
Import/update local state
      ↓
Immediate UI update
      ↓
Outbox/sync
      ↓
Convex/cloud
```

Exports that can safely operate from local data should work offline.

Operations that genuinely require server-side processing should clearly indicate that requirement rather than making the entire page unusable offline.

Do not introduce unnecessary network gates.

---

# 11. UX Architecture

Create a professional import experience:

```text
Import Products

1. Upload
2. Map Columns
3. Preview
4. Validate
5. Import
6. Results
```

The user should always understand:

* What is happening.
* What failed.
* What will be changed.
* How many records succeeded.
* How many failed.
* Why records failed.

Provide downloadable error/result reports where useful.

For exports, use a consistent export menu throughout the application rather than different UI patterns on every page.

---

# 12. Super Admin Visibility

Because this is a SaaS platform, Super Admin should eventually be able to see appropriate platform-level metrics around:

* Imports
* Exports
* Usage
* Storage
* Plan utilization
* Organizations approaching limits
* Failed import jobs
* Export activity where appropriate

Respect tenant privacy and RBAC.

Do not expose organization data unnecessarily.

---

# 13. Architecture / Design Loop

Use this implementation loop:

### Phase 1 — Audit

Inspect:

* Current product schema
* Existing import functionality
* Existing export functionality
* Report architecture
* Analytics architecture
* SaaS plan model
* Organization model
* Usage tracking
* RBAC
* IndexedDB repositories
* Convex mutations/queries

Identify duplication and architectural gaps.

### Phase 2 — Design

Define:

* Import service
* Header mapping engine
* Validation engine
* Import job/result model
* Export service
* Export format adapters
* Entitlement service
* Usage tracking
* Plan enforcement
* Local/offline integration

Reuse existing infrastructure wherever possible.

### Phase 3 — Implement

Build the shared architecture first, then integrate:

1. Product import
2. Product export
3. Reports export
4. Analytics export
5. Plan entitlements
6. Usage limits
7. UI

### Phase 4 — Verify

Test:

* Different spreadsheet headers
* Missing headers
* Duplicate products
* Invalid values
* Large imports
* Product limits
* Unauthorized organization access
* Offline import where supported
* Sync after reconnect
* CSV export
* XLSX export
* PDF export
* Filtered reports
* Branch-scoped reports
* Plan restrictions
* Upgrade scenarios

---

# 14. Git Commit Discipline

This is important.

Do NOT make one enormous undocumented commit.

After each major completed feature/fix/refactor/chore, create an appropriate Git commit.

Examples:

```text
feat: add product import pipeline
feat: add dynamic product column mapping
feat: add product export service
feat: add report export framework
feat: add analytics export formats
feat: add plan entitlements for imports and exports
feat: add organization usage tracking
refactor: centralize export generation
refactor: centralize SaaS entitlement checks
fix: enforce organization scope during imports
fix: prevent export data leakage across branches
chore: add import/export validation tests
```

Use meaningful commits that describe the actual change.

---

# Final Requirement

This is a **major architectural feature**, not simply an import button and a few export buttons.

Before coding, inspect the existing architecture and produce a concise implementation/design report showing:

1. Current product schema.
2. Current import/export implementation.
3. Current reporting/analytics architecture.
4. Current SaaS plan/entitlement architecture.
5. Current organization/RBAC boundaries.
6. Current IndexedDB/offline architecture.
7. Gaps and risks.
8. Proposed reusable architecture.
9. Implementation phases.
10. Tests required.

Then implement incrementally.

Do not hallucinate existing fields, plans, APIs, or database structures. Inspect the codebase first and build on what already exists.
