When this is done, perform a **complete industry-by-industry production-readiness audit** of the system.

Act as a **senior software engineer and production systems architect** challenged to make the entire POS reliable across all supported business types. Use the existing architecture, design system, offline-first principles, security model, data model, and business workflows as the baseline. The system is intended to be a commercial, production-ready product, so do not treat these changes as superficial UI updates.

### 1. Audit Every Industry Individually

Review every existing industry type **one by one** rather than assuming that the generic POS workflow works for all industries.

For each industry:

- Review the complete user/business workflow.
- Identify missing industry-specific functionality.
- Audit product, inventory, sales, purchases, returns, customers, suppliers, expenses, reports, settings, and analytics where applicable.
- Check data models and relationships.
- Check validation and business rules.
- Check calculations and pricing algorithms.
- Check stock/inventory algorithms.
- Check permissions and RBAC.
- Check offline behavior.
- Check synchronization and conflict handling.
- Check security boundaries and authorization.
- Check audit logging.
- Check branch-specific behavior.
- Check edge cases and failure states.
- Check whether the UI actually represents the industry's workflow correctly.
- Check for broken, incomplete, duplicated, or contradictory logic.
- Check whether functionality works after restart and during complete offline operation.
- Check whether industry-specific functionality introduces unnecessary Convex usage or cloud dependencies.

Do not simply report gaps. **Fix the identified issues.**

### 2. Industry-Specific Product Variants

Ensure the product model properly supports industries where products have meaningful variants.

For example, fashion and cosmetics may require variants such as:

- Size
- Color
- Style
- Material
- Fragrance
- Shade
- Volume
- Pack size
- Other industry-specific attributes

Do not implement variants as unrelated duplicate products if a proper variant model is more appropriate.

The implementation should support:

- Parent products and variants where appropriate.
- Variant-specific SKU/barcode.
- Variant-specific pricing where required.
- Variant-specific stock quantities.
- Variant-specific cost.
- Variant-specific inventory movements.
- Variant selection during POS sales.
- Variant handling in purchases and returns.
- Variant-aware reporting and analytics.
- Offline persistence and synchronization.
- Proper validation and uniqueness rules.

Keep the model flexible enough to support future industries without creating a separate codebase for every industry.

### 3. Review and Expand Industry Coverage

Review the current industry list and determine whether important commercial industries are missing.

At minimum, evaluate support for industries such as:

- Pharmacy
- Supermarket
- Wholesale
- General retail
- Fashion
- Cosmetics
- Electronics
- Hardware
- Stationery
- Convenience stores

Also identify other industries that naturally fit the POS architecture and add them where appropriate.

Do not add industries merely for marketing purposes. Each added industry must have a meaningful workflow and usable configuration.

### 4. Security Audit

For every industry and shared module, audit:

- Authentication
- Authorization
- RBAC
- Branch access
- Organization isolation
- Local session handling
- Sensitive local data
- Sync authorization
- Convex authorization
- Input validation
- Data integrity
- Audit trails
- Soft deletion
- Conflict resolution
- Privilege escalation risks
- Client-side trust assumptions
- Offline security boundaries

Fix security weaknesses rather than merely documenting them.

### 5. Data & Algorithm Audit

Review all industry-related data flows and algorithms.

Pay particular attention to:

- Inventory calculations
- Stock movements
- Product quantities
- Variant quantities
- Pricing
- Discounts
- Taxes
- Profit calculations
- Returns
- Purchase costs
- Wholesale pricing
- Customer balances
- Supplier balances
- Branch transfers
- Sales totals
- Analytics
- Reports
- Synchronization
- Conflict resolution

Ensure calculations remain deterministic and consistent between offline and online states.

Do not introduce cloud dependencies into workflows that are required to work offline.

### 6. Offline-First Audit

Every industry must respect the system's offline-first architecture.

Critical business operations must:

1. Execute locally.
2. Persist locally.
3. Update local state immediately.
4. Generate the appropriate sync operation/event.
5. Synchronize later when connectivity becomes available.

Audit reconnect behavior, application restart, failed synchronization, duplicate operations, retries, conflicts, and partial failures.

Do not solve offline problems by simply forcing network requests.

### 7. Convex / Cloud Usage

Maintain the project's goal of **minimal Convex usage**.

Review every new or modified operation and determine whether it genuinely needs cloud interaction.

Prefer:

- Local reads.
- Local writes.
- Batched synchronization.
- Event/operation-based sync.
- Minimal remote queries.
- Minimal remote mutations.
- Cached remote data where appropriate.

Do not introduce unnecessary queries, mutations, subscriptions, or repeated cloud reads.

### 8. Design Loop

Use a proper design loop for the work:

**Inspect → Understand → Audit → Identify gaps → Design solution → Implement → Validate → Refactor → Test → Review → Commit**

Do not rush into implementation before understanding the existing architecture and industry behavior.

Before modifying a module, trace its dependencies and understand how the change affects:

- Web
- Electron
- PWA/mobile
- IndexedDB/Dexie
- Sync engine
- Convex
- Shared packages
- RBAC
- Analytics
- Reports
- Settings

Avoid breaking existing industries while improving another.

### 9. Local Staging Branch & Commit Strategy

All work must remain on the **local staging branch**.

Do not push changes unless explicitly instructed.

Each industry or clearly isolated piece of work should have its own meaningful commit.

Use commit types such as:

- `fix(industry): ...`
- `refactor(industry): ...`
- `feat(industry): ...`
- `chore(industry): ...`
- `security(industry): ...`

Examples:

`fix(pharmacy): correct batch inventory and expiry handling`

`feat(fashion): add product variant support for size and color`

`fix(cosmetics): support shade and fragrance variants`

`security(wholesale): enforce branch and pricing permissions`

`refactor(inventory): normalize variant stock calculations`

Keep commits focused and logically reversible. Do not create one giant commit containing unrelated industry changes.

### 10. Production-Readiness Requirement

Do not consider an industry complete simply because its UI loads.

An industry is complete only when its:

- UI
- Workflow
- Data model
- Validation
- Business rules
- Algorithms
- Inventory behavior
- POS behavior
- Returns
- Purchases
- Reports
- Permissions
- Security
- Offline behavior
- Sync behavior
- Error handling
- Edge cases

have been reviewed and corrected where necessary.

Run the appropriate linting, type checks, tests, builds, and relevant validation after each significant change.

Fix errors introduced by the changes before moving to the next industry.

### 11. Final Verification

After all industries have been audited and updated:

- Run a final cross-industry regression review.
- Check shared components for regressions.
- Check that one industry's implementation has not broken another.
- Check database migrations/schema compatibility.
- Check offline/reconnect behavior.
- Check sync consistency.
- Check security boundaries.
- Check production builds.
- Check TypeScript/lint/test errors.
- Review all local commits.
- Confirm the working tree and staging branch are in a clean, understandable state except for intentionally uncommitted work.

The final result should be a **production-ready multi-industry POS**, not merely a collection of industry-specific UI configurations.

Use the existing project overview as the architectural baseline: the system is designed as a commercial offline-first POS where IndexedDB is the primary operational database and Convex is used for synchronization, backup, remote access, and monitoring rather than as the operational database.

# NOTE

Pharmacy have one active user. dont delete data to that or cause any break