# Novend Cloud Modes Architecture

## Master Cursor Implementation Loop

### Objective

Implement a production-ready **per-organization cloud mode architecture** for Novend so organizations can operate under different levels of cloud usage without breaking the existing offline-first behavior.

The three supported modes are:

```ts
type CloudMode = "full_sync" | "backup_only" | "local_only";
```

The purpose is to reduce recurring Convex usage for selected organizations, especially lifetime-license customers, while preserving Novend's local-first functionality.

This must be implemented as a first-class architectural feature, not by randomly disabling Convex calls.

---

# 1. Core Behavior

## `full_sync`

This is the current/default Novend behavior.

```text
User action
↓
Dexie
↓
Outbox
↓
Background sync
↓
Convex
```

Provides:

- Cloud backup
- Cross-device synchronization
- Remote monitoring
- Multi-branch cloud synchronization
- Remote admin access
- Cloud recovery
- Regular synchronization

---

## `backup_only`

The organization operates locally first, but cloud synchronization is reduced dramatically.

```text
User action
↓
Dexie
↓
Local operation
↓
Deferred cloud queue
↓
Scheduled/manual backup
↓
Convex
```

The system must NOT continuously synchronize routine changes.

Synchronization occurs only according to configured policy, such as:

- Manual backup
- Scheduled backup
- Application close if appropriate
- Daily interval
- Explicit administrator trigger
- Critical configuration changes where absolutely required

This mode is intended for customers who want cloud protection but do not require real-time synchronization.

---

## `local_only`

No routine operational Convex synchronization.

```text
User action
↓
Dexie
↓
Local repository
↓
Local operation complete
```

Supported local functionality should continue working normally:

- POS
- Sales
- Products
- Inventory
- Returns
- Customers
- Expenses
- Reports
- Analytics
- Printing
- Users
- Settings
- Branch functionality that can operate locally
- Hardware
- Electron offline operation

Cloud-dependent functionality must be explicitly marked unavailable where applicable.

---

# 2. Non-Negotiable Principles

Do not break these existing Novend principles.

## Offline-first remains primary

All supported business operations must continue to execute locally first.

The UI must never require Convex availability before completing local operations.

---

## Existing organizations must remain unchanged

All current organizations should default to:

```ts
cloudMode = "full_sync";
```

unless explicitly changed.

Do not migrate existing organizations into another mode automatically.

---

## No scattered cloud-mode conditionals

Do not add code like this everywhere:

```ts
if (org.cloudMode === "local_only") {
   ...
}
```

Instead, create a centralized cloud policy/service.

Preferred architecture:

```text
UI
↓
Domain Service
↓
Repository
↓
Dexie
↓
Cloud Policy
   ├── Full Sync
   ├── Backup Only
   └── Local Only
```

---

# 3. Git Workflow

Use:

```text
main
staging
```

Do not work directly on `main`.

For every implementation phase:

```text
staging
↓
feat/... or refactor/... or fix/...
↓
implement
↓
test
↓
push
↓
merge into staging
↓
test staging
↓
continue
```

At the end:

```text
staging → main PR
```

The final PR must remain open.

Do not merge or close it automatically.

---

# 4. Initial Branch Setup

Before beginning:

```bash
git checkout main
git pull origin main

git checkout staging
git pull origin staging
git merge origin/main
```

If `staging` does not exist:

```bash
git checkout main
git pull origin main
git checkout -b staging
git push -u origin staging
```

Run the existing validation suite before architecture changes.

Do not start if staging is already broken.

---

# 5. Phase 1 Branch

Create:

```bash
git checkout staging
git pull origin staging
git checkout -b feat/cloud-mode-foundation
```

---

# 6. Phase 1 — Cloud Mode Foundation

Implement the central architecture first.

## Organization Schema

Add an organization-level setting:

```ts
cloudMode: "full_sync" | "backup_only" | "local_only";
```

Default:

```ts
"full_sync";
```

Existing organizations must automatically behave as `full_sync` when the field is missing.

Do not require destructive migration.

---

## Cloud Policy Service

Create a single service responsible for resolving cloud behavior.

Conceptually:

```ts
interface CloudPolicy {
  mode: CloudMode;

  shouldQueueRealtimeSync(): boolean;
  shouldQueueBackup(): boolean;
  shouldRunBackgroundSync(): boolean;
  shouldUseRealtimeSubscriptions(): boolean;
  shouldAllowRemoteMonitoring(): boolean;
  shouldAllowRemoteDeviceSync(): boolean;
}
```

Avoid hardcoding mode behavior in UI components.

---

## Suggested Policy Matrix

```text
Capability                    full_sync   backup_only   local_only

Local reads                       yes          yes           yes
Local writes                      yes          yes           yes
Realtime Convex writes            yes          no            no
Outbox realtime flush             yes          no            no
Scheduled cloud backup            yes          yes           no
Manual backup                     yes          yes           optional
Cloud recovery                    yes          yes           no
Remote monitoring                 yes          limited       no
Cross-device cloud sync           yes          limited/no    no
Realtime subscriptions            yes          avoid         no
Local reporting                   yes          yes           yes
```

Adjust based on actual Novend implementation.

---

# 7. Repository Audit

Before modifying sync logic, inspect:

- Dexie repositories
- Convex repositories
- outbox implementation
- sync triggers
- query hooks
- background synchronization
- application startup
- page boot queries
- tab-focus synchronization
- periodic synchronization
- branch synchronization
- remote monitoring
- authentication/session dependencies
- Electron startup
- browser/PWA startup

Identify every path that causes Convex usage.

Document these before making changes.

---

# 8. Centralize Cloud Decisions

Where possible, change architecture from:

```text
Component
↓
Convex directly
```

toward:

```text
Component
↓
Domain/Repository
↓
Local DB
↓
Cloud policy
```

Do not rewrite the entire project unnecessarily.

Refactor only the paths needed to enforce cloud modes safely.

---

# 9. Full Sync Compatibility

`full_sync` must reproduce existing behavior exactly.

Before proceeding, validate:

```text
Sales
Inventory
Returns
Products
Customers
Users
Branches
Reports
Settings
Electron
Offline
Reconnect
Remote sync
```

No behavior change is allowed for full-sync organizations.

---

# 10. Phase 1 Validation

Test:

```text
Existing org with missing cloudMode
→ behaves as full_sync

New org
→ defaults full_sync

Mode stored locally
→ available offline

Mode synchronized correctly
→ no org isolation issue
```

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Use actual project scripts if different.

---

# 11. Phase 1 Completion

Commit:

```text
feat: add organization cloud mode foundation
```

Push branch.

Merge into `staging`.

Re-run validation on staging.

Only proceed if staging passes.

---

# 12. Phase 2 Branch

Create:

```bash
git checkout staging
git pull origin staging
git checkout -b feat/backup-only-cloud-mode
```

---

# 13. Phase 2 — Backup Only Mode

Implement reduced-cloud behavior.

The key rule:

> Local operation remains immediate. Cloud synchronization becomes scheduled or manually triggered instead of continuous.

---

# 14. Backup Queue Strategy

Decide whether to:

- reuse the existing outbox with different flush policy
- or introduce a dedicated deferred backup queue

Prefer reusing existing outbox architecture where safe.

Do not duplicate sync systems unnecessarily.

---

# 15. Backup Only Write Flow

Expected flow:

```text
Sale completed
↓
Dexie transaction
↓
Local inventory update
↓
Receipt available
↓
Operation recorded locally
↓
Marked pending backup
↓
No immediate Convex write
```

Then later:

```text
Scheduled/manual backup
↓
Batch pending operations
↓
Convex validation
↓
Acknowledgement
↓
Mark backed up locally
```

---

# 16. Backup Scheduling

Support a configurable backup strategy.

Possible organization settings:

```ts
backupPolicy: {
  enabled: boolean;
  interval?: "manual" | "daily" | "custom";
  intervalHours?: number;
  backupOnAppClose?: boolean;
}
```

Do not force excessive intervals.

Recommended safe initial behavior:

```text
Manual backup
+
Periodic backup every configured hours
```

Avoid minute-by-minute cloud synchronization.

---

# 17. Batch Operations

Where practical, batch backup operations instead of one request per local event.

Prefer:

```text
100 pending operations
→ grouped backup request/batches
```

instead of:

```text
100 independent Convex calls
```

Respect Convex limits and existing sync architecture.

---

# 18. Backup Checkpointing

Store local metadata such as:

```ts
lastBackupAt;
lastBackupSuccessAt;
lastBackupError;
pendingBackupCount;
backupCheckpoint;
```

This should be visible in settings.

---

# 19. Backup Only UI

Add organization/admin information showing:

```text
Cloud Mode
Backup Only

Last backup:
18 Sep 2026, 14:30

Pending:
24 operations

Next scheduled backup:
...

[Back Up Now]
```

Do not expose unnecessary internal technical terminology to normal business users.

---

# 20. Backup Failure Behavior

If backup fails:

- local operation remains valid
- POS must continue working
- pending data stays queued
- retry must be possible
- no duplicate operations
- show actionable status
- never delete pending data

---

# 21. Backup Only Query Strategy

Audit read paths.

Avoid continuous Convex subscriptions when the organization is `backup_only`.

Prefer:

```text
Dexie
↓
periodic refresh if needed
```

Remote monitoring may show:

```text
Last cloud backup data
```

rather than pretending it is live.

Clearly distinguish stale cloud data from live data.

---

# 22. Backup Only Multi-Device Behavior

Do not pretend backup-only provides real-time device sync.

Define explicit behavior.

Possible initial policy:

```text
backup_only =
local-first device operation
+
cloud backup
+
no guarantee of realtime cross-device consistency
```

If cross-device merge exists, keep it conservative.

Document limitations clearly.

---

# 23. Phase 2 Validation

Test:

```text
Create sale
→ no immediate Convex sync

Create product
→ local first

Create return
→ local first

Restart app
→ pending backup survives

Trigger manual backup
→ pending operations sync

Disconnect during backup
→ queue preserved

Reconnect
→ backup can resume

Duplicate retry
→ no duplicate transaction
```

Also validate:

```text
full_sync still behaves unchanged
```

---

# 24. Phase 2 Completion

Commit:

```text
feat: add backup-only cloud synchronization mode
```

Push.

Merge into staging.

Validate staging.

Only continue when healthy.

---

# 25. Phase 3 Branch

Create:

```bash
git checkout staging
git pull origin staging
git checkout -b feat/local-only-cloud-mode
```

---

# 26. Phase 3 — Local Only Mode

Implement zero-routine-cloud operation.

The principle:

> Novend remains a complete local business application even when cloud services are intentionally disabled.

---

# 27. Local Only Write Flow

Expected behavior:

```text
User action
↓
Local validation
↓
Dexie transaction
↓
Local inventory/accounting effects
↓
Audit attribution
↓
UI update
```

Stop there.

Do not automatically:

- queue Convex sync
- run Convex mutations
- run realtime subscriptions
- run periodic cloud sync
- run remote monitoring synchronization

---

# 28. Local-Only Operation Metadata

Do not lose architectural compatibility.

Consider marking operations as:

```ts
syncPolicy: "local_only";
```

or equivalent.

This helps future migration.

Do not permanently discard information needed if the organization upgrades to cloud later.

---

# 29. Local Audit Trail

Local-only must still preserve:

- actor
- timestamp
- branch
- device
- operation
- before/after where applicable
- transaction references

Cloud-disabled must never mean audit-disabled.

---

# 30. Local Organization Configuration

Cache all required organization configuration locally:

```text
Business details
Branches
Users
Roles
Permissions
Products
Inventory
Pricing
Customers
Settings
Receipt configuration
Hardware configuration
Cloud mode
```

The application must not need Convex to render core UI.

---

# 31. Electron Offline Startup

Local-only mode must work when the computer has never had internet during that application session.

Test:

```text
Launch Electron
↓
No internet
↓
Restore session
↓
Load Dexie
↓
Load dashboard
↓
Render UI
↓
POS usable
```

No blank screen.

No blocking cloud bootstrap.

---

# 32. Authentication Considerations

Audit authentication carefully.

Local-only organizations must not become unusable because login requires remote Convex authentication every time.

Use the existing secure local-session strategy where possible.

Do not weaken authorization.

Do not store plaintext passwords.

If current auth requires cloud revalidation, implement a safe offline-auth/session policy rather than bypassing authentication entirely.

---

# 33. Local-Only Branches

If multiple branches share one local device/database, support them normally.

If branches exist on physically separate devices:

```text
local_only
```

must not pretend they automatically synchronize.

Show clear limitations.

Future LAN sync can be added later.

Do not implement LAN sync in this phase unless already architecturally supported.

---

# 34. Local Backup

Even local-only customers need protection from device failure.

Add or strengthen local backup/export options.

Recommended:

```text
Encrypted local backup
Manual export
Scheduled filesystem backup in Electron
Restore from backup
```

This is separate from Convex.

Prefer a versioned backup format.

---

# 35. Local Backup Integrity

Backup should contain all required local state:

```text
Organization
Branches
Users
Products
Inventory
Sales
Sale items
Payments
Returns
Customers
Expenses
Settings
Audit records
Configuration
```

Do not export secrets unnecessarily.

---

# 36. Cloud-Dependent Feature Guards

When `local_only` is active, explicitly disable or explain features such as:

```text
Remote monitoring
Remote dashboard
Cloud recovery
Cloud multi-device sync
Cloud branch sync
Remote owner access
```

Prefer:

```text
Cloud services are disabled for this organization.
```

not broken buttons or indefinite loading.

---

# 37. Upgrade Path

A local-only organization may later move to:

```text
backup_only
```

or:

```text
full_sync
```

Design for this now.

Do not make the transition destructive.

---

# 38. Local → Cloud Migration

When enabling cloud after local-only usage:

Do not blindly push all records without validation.

Implement a controlled migration flow:

```text
Cloud mode change requested
↓
Preflight
↓
Count local records
↓
Validate organization identity
↓
Validate IDs
↓
Detect conflicts
↓
Initial cloud seed
↓
Checkpoint
↓
Enable normal sync
```

---

# 39. Prevent Duplicate Seeding

Initial upload must be idempotent.

Use stable UUIDs and operation IDs.

Do not generate new cloud IDs for existing local records unnecessarily.

---

# 40. Cloud Mode Switching Rules

Recommended transition matrix:

```text
full_sync → backup_only
Allowed

backup_only → full_sync
Allowed

backup_only → local_only
Allowed with confirmation

local_only → backup_only
Requires initial cloud seed

local_only → full_sync
Requires initial cloud seed
```

Changing modes must never delete local business data.

---

# 41. Super Admin Control

Add cloud mode management to the Novend Super Admin layer.

Normal organization admins should not necessarily be allowed to change licensing-related cloud modes.

Recommended:

```text
Super Admin
↓
Organization
↓
Cloud Services
```

Fields:

```text
Cloud Mode
Plan
Cloud entitlement
Last sync
Last backup
Pending operations
Cloud status
```

---

# 42. Licensing Integration

Keep cloud mode separate from plan internally.

Bad:

```ts
if (plan === "lifetime") {
  disableCloud();
}
```

Better:

```text
Plan
↓
Entitlements
↓
Cloud Mode Policy
```

Example:

```ts
Lifetime: allowedCloudModes: -local_only - backup_only;

Pro: allowedCloudModes: -full_sync;

Enterprise: allowedCloudModes: -full_sync - backup_only;
```

This gives you flexibility later.

---

# 43. Lifetime Plan Strategy

Recommended default:

```text
Lifetime License
+
Local Only
```

Optional paid add-on:

```text
Cloud Services
+
Backup
+
Remote Monitoring
+
Multi-device Sync
```

This avoids promising lifetime recurring cloud infrastructure for a one-time license.

---

# 44. Settings UI

For organization-facing Settings, show descriptive status.

Example:

```text
Cloud Services

Mode:
Local Only

Your business data is stored and processed on this device.

Unavailable:
- Remote monitoring
- Cloud backup
- Cross-device synchronization

Local backup:
Enabled

Last local backup:
...
```

For backup-only:

```text
Cloud Services

Mode:
Backup Only

Last cloud backup:
...

Pending changes:
...

[Back Up Now]
```

---

# 45. Sync Status UI

Update existing sync indicators.

Do not display:

```text
Syncing...
```

in local-only mode.

Possible states:

```text
Synced
Backup Pending
Backing Up
Local Only
Offline
Backup Error
```

Avoid unnecessary banner flicker.

---

# 46. Convex Query Audit

Search the entire repository for:

```text
useQuery
useMutation
useAction
ConvexClient
ConvexReactClient
fetchQuery
fetchMutation
subscriptions
```

Classify each use:

```text
Required for auth
Required for cloud sync
Required for remote monitoring
Can use Dexie
Can be removed from page render
Can be periodic
Can be disabled in local_only
```

Document findings.

---

# 47. Reduce Convex Usage Beyond Mode Switching

During this architecture work, also eliminate obvious waste.

Examples:

- Fetch one record instead of full collections.
- Use indexed queries.
- Avoid duplicate subscriptions.
- Avoid queries on every render.
- Avoid sync cycles when outbox is empty.
- Cache stable organization settings.
- Cache permissions.
- Cache catalog locally.
- Batch sync operations.
- Use delta sync.
- Avoid fetching unchanged records.
- Reduce polling.

Do not perform risky unrelated refactors.

---

# 48. Monitoring Usage

Add internal diagnostics where practical.

Track locally:

```text
Sync requests
Backup requests
Records uploaded
Records downloaded
Last sync duration
Last backup duration
Pending operations
Failed operations
```

This will help measure whether Convex usage is actually reduced.

---

# 49. Security Requirements

Cloud mode must never bypass:

- organization isolation
- branch authorization
- RBAC
- audit attribution
- completed-sale immutability
- input validation
- inventory validation
- secure local sessions

Local-only means local persistence, not weaker security.

---

# 50. Data Integrity

Do not allow negative inventory silently where current business rules prohibit it.

Offline conflicts should follow existing reconciliation policy.

Completed sales must remain immutable.

Returns must create reversal records instead of rewriting sales.

---

# 51. Tests Required for All Three Modes

Create shared behavior tests.

Example:

```text
Operation:
Create Sale
```

Run under:

```text
full_sync
backup_only
local_only
```

Expected local result should remain equivalent.

Only cloud behavior differs.

Repeat for:

```text
Product create
Product edit
Inventory adjustment
Sale
Return
Customer
Expense
Branch-aware operation
```

---

# 52. Full Mode Matrix

Validate:

| Behavior                |   Full Sync | Backup Only | Local Only |
| ----------------------- | ----------: | ----------: | ---------: |
| Local POS               |         Yes |         Yes |        Yes |
| Local inventory         |         Yes |         Yes |        Yes |
| Offline launch          |         Yes |         Yes |        Yes |
| Continuous cloud sync   |         Yes |          No |         No |
| Scheduled cloud backup  |         Yes |         Yes |         No |
| Remote monitoring       |         Yes |     Limited |         No |
| Cross-device cloud sync |         Yes |  Limited/No |         No |
| Local reports           |         Yes |         Yes |        Yes |
| Printing                |         Yes |         Yes |        Yes |
| Local backup            | Recommended | Recommended |   Required |

---

# 53. Regression Gate

Before every merge to staging, test default `full_sync` organization.

It must behave exactly as production Novend currently behaves.

This is critical.

---

# 54. Branch Validation Loop

For each branch:

```text
Inspect
↓
Plan
↓
Implement
↓
Migrate
↓
Test
↓
Offline test
↓
Reconnect test
↓
Regression test
↓
Lint
↓
Typecheck
↓
Tests
↓
Build
↓
Docs
↓
Commit
↓
Push
↓
Merge to staging
↓
Validate staging
```

Do not move to the next phase when staging is broken.

---

# 55. Expected Branches

Suggested implementation sequence:

```text
feat/cloud-mode-foundation

feat/backup-only-cloud-mode

feat/local-only-cloud-mode

feat/cloud-mode-super-admin

feat/local-backup-recovery

refactor/cloud-query-policy

fix/<issues-found-during-validation>
```

Do not create them all at once.

Create the next branch only after the previous work is integrated and validated.

---

# 56. Documentation

Create/update architecture documentation covering:

```text
Cloud modes
Expected behavior
Feature availability
Data flow
Sync behavior
Backup behavior
Recovery
Mode switching
Licensing
Super Admin control
Offline behavior
Known limitations
```

---

# 57. Progress Report After Every Loop

Report:

```text
Phase:
Branch:
Status:

Implemented:
- ...

Dexie:
- ...

Convex:
- ...

Sync:
- ...

UI:
- ...

Security/RBAC:
- ...

Tests:
- ...

Offline validation:
- ...

Convex usage impact:
- ...

Commit:
...

Merged into staging:
Yes / No

Staging healthy:
Yes / No

Next phase:
...
```

---

# 58. Final Integration

After all cloud-mode architecture work has passed:

```bash
git checkout staging
git pull origin staging
git fetch origin
git merge origin/main
```

Resolve conflicts.

Run the entire validation suite.

Then push:

```bash
git push origin staging
```

Create:

```text
staging → main
```

PR.

Suggested title:

```text
feat: introduce configurable cloud modes and local-only operation
```

---

# 59. Final PR Rule

DO NOT:

```text
merge the PR
close the PR
delete staging
auto-squash into main
```

The final PR must remain open.

I will manually review and merge it.

---

# 60. Final Goal

The completed architecture should allow Novend to support three commercial operating models:

```text
FULL SYNC
For subscription customers requiring complete cloud services.

BACKUP ONLY
For customers wanting cloud protection with minimal recurring cloud usage.

LOCAL ONLY
For lifetime or offline-focused customers who should generate essentially no routine Convex operational usage.
```

All three must share the same:

```text
POS
business logic
inventory rules
RBAC
reporting
offline database
Electron app
hardware layer
audit model
```

Only the **cloud policy** changes.

The architecture must make cloud services optional without turning Novend into multiple separate products.

Build one Novend.

Change the cloud entitlement, not the business engine.
