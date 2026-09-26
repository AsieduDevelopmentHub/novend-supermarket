# Novend Cloud Modes Architecture

## Updated Analytics, Platform Telemetry & Super Admin Control

## Org-wide temporary sync boost

When a **new or empty till** signs in and the PEAS planned mode is not `full_sync`, Novend starts an **org-wide** temporary boost:

- Fields: `organizations.cloudSyncBoostUntil` (+ startedAt / reason). PEAS `cloudMode` is **not** rewritten.
- `licenseSnapshot.cloudMode` becomes **effective** `full_sync` for all org clients while the boost is active; `plannedCloudMode` and `syncBoostUntil` are also returned.
- Every till briefly enables realtime pull + outbox flush so older devices can push and the new till can pull.
- TTL: Super Admin configurable — org override → `platformDefaults.cloudSyncBoostTtlMinutes` → **30 minutes**. Refresh only when less than **one-third** of the effective TTL remains.
- Allowed lengths: 15 / 30 / 45 / 60 / 90 / 120 minutes (`platform.setGlobalCloudSyncBoostTtl`, `platform.setOrganizationCloudSyncBoostTtl`).
- While boosted, tills flush **outbox events** (sales, restocks, etc.) and **pull** the compact Dexie mirror (`offline.getSnapshot`) — not an encrypted cloud package upload.
- Triggers: `devices.registerDevice` on create/reactivate; `devices.requestCloudSyncBoost` when Dexie has no catalog.
- Restore gate is skipped while effective mode is boosted.

## Dexie local-write invariant

Package / local modes skip **cloud pull/outbox**, not **local Dexie writes**. Inventory and other business lists must prefer Dexie when realtime subscriptions are off. Online stock edits on those modes call Convex directly (mirror-only Dexie write) so Sales and Inventory stay aligned.

## Important Architecture Update

Novend must treat **business analytics** and **platform analytics** as two completely separate systems.

Do not use organization business synchronization as the source for Super Admin platform analytics.

The architecture must clearly distinguish:

```text
BUSINESS DATA
├── Sales
├── Sale Items
├── Inventory
├── Customers
├── Returns
├── Expenses
├── Purchases
├── Payments
└── Business Analytics

PLATFORM DATA
├── Organization Status
├── Plan
├── License
├── Cloud Mode
├── Device Count
├── User Count
├── Branch Count
├── App Version
├── Last Active
├── Last Backup
├── Sync Health
├── Storage Usage
├── Feature Entitlements
└── Platform Limits
```

These must have separate data flows.

---

# 1. Business Analytics

Organization analytics must remain fully local-first.

Examples:

```text
Revenue
Profit
Sales
Returns
Expenses
Inventory value
Top products
Customer analytics
Branch performance
Daily trends
Monthly trends
```

These should primarily use:

```text
Dexie
+
Local analytics aggregates
```

They must not require Convex.

Therefore:

```text
full_sync
backup_only
local_only
```

must all have functioning organization analytics.

---

# 2. Platform Analytics

Super Admin analytics is different.

The platform needs limited centralized information to manage Novend itself.

Super Admin should still be able to see metrics such as:

```text
Total organizations
Active organizations
Organizations by plan
Organizations by cloud mode
Total registered branches
Total registered users
Total registered devices
App versions in use
Organizations recently active
Organizations with outdated clients
Backup failures
Sync failures
License status
Storage allocation
Storage usage
Plan limits
Entitlement usage
```

However, platform analytics must NOT require complete organization business data.

---

# 3. Platform Telemetry Pipeline

Create a dedicated lightweight telemetry architecture.

Target:

```text
Organization
        │
        ├──────── Business Operations ────────┐
        │                                     │
        │                                Cloud Policy
        │                                     │
        │                          Full / Backup / Local
        │
        └──────── Platform Telemetry
                          │
                          ↓
                    Tiny Payload
                          │
                          ↓
                       Convex
                          │
                          ↓
              Super Admin Dashboard
```

Platform telemetry must be independent from business-data synchronization.

---

# 4. Local Only Does Not Mean Platform Blindness

For:

```text
cloudMode = "local_only"
```

do not synchronize routine business data.

Do not upload:

```text
Sales
Customers
Products
Inventory movements
Returns
Expenses
Payments
Business reports
```

But Novend may still send a very small operational telemetry heartbeat when internet is available.

This heartbeat exists only for:

```text
Licensing
Platform management
Usage limits
Operational health
Version tracking
Minimal Super Admin analytics
```

---

# 5. Minimal Telemetry Payload

Design the payload to be extremely small.

Conceptually:

```ts
interface PlatformTelemetrySnapshot {
  organizationId: string;

  cloudMode: "full_sync" | "backup_only" | "local_only";

  planId: string;

  appVersion: string;

  branchCount: number;
  userCount: number;
  deviceCount: number;

  localStorageBytes?: number;

  lastBackupAt?: number;

  pendingSyncCount?: number;
  failedSyncCount?: number;

  sentAt: number;
}
```

Do not send raw business records.

Do not send arrays if a count is sufficient.

Do not send repeated organization metadata already known by Convex.

---

# 6. Prefer Deltas Over Full Telemetry

Do not repeatedly send the same values.

Maintain locally:

```text
lastTelemetrySnapshot
lastTelemetrySentAt
```

Before sending telemetry:

```text
Current snapshot
↓
Compare with previous snapshot
↓
Meaningful change?
```

If no meaningful change:

```text
do not send
```

Example:

Previous:

```json
{
  "branches": 3,
  "users": 8,
  "devices": 4,
  "version": "0.4.2"
}
```

Current:

```json
{
  "branches": 3,
  "users": 8,
  "devices": 4,
  "version": "0.4.2"
}
```

Result:

```text
NO WRITE
```

This rule is important for minimizing Convex usage.

---

# 7. Telemetry Trigger Strategy

Do not implement continuous polling.

Telemetry should be event-triggered and rate-limited.

Recommended triggers:

```text
App launch
App version changed
Cloud mode changed
Plan/entitlement changed
Branch count changed
User count changed
Device registration changed
Backup status materially changed
Sync health materially changed
Periodic stale heartbeat
```

---

# 8. Heartbeat Frequency

A heartbeat should exist only so Super Admin can determine whether an organization remains active.

Use a conservative interval.

Recommended initial policy:

```text
Maximum one heartbeat every 24 hours
```

Do not send hourly telemetry unless there is a proven requirement.

Logic:

```text
Application starts
↓
Read lastTelemetrySentAt
↓
Older than 24 hours?
├── No → do nothing
└── Yes
      ↓
Internet available?
├── No → do nothing
└── Yes → send minimal heartbeat
```

---

# 9. Significant Changes Can Send Immediately

Some events may send telemetry without waiting 24 hours.

Examples:

```text
License changed
Plan changed
Cloud mode changed
Device activated
Device revoked
Organization suspended
App upgraded
Platform limit exceeded
```

These should still be deduplicated.

---

# 10. Do Not Use Scheduler for Everything

Do not create a server scheduler that continuously calculates Super Admin statistics.

Prefer:

```text
Event changes
↓
Update lightweight aggregate
```

Instead of:

```text
Every 5 minutes
↓
Read all organizations
↓
Recalculate everything
```

Platform analytics should be incremental where possible.

---

# 11. Platform Aggregate Model

Create small platform aggregate records.

For example:

```ts
platformStats {
  organizationCount
  activeOrganizationCount
  fullSyncCount
  backupOnlyCount
  localOnlyCount

  basicPlanCount
  proPlanCount
  enterprisePlanCount
  lifetimePlanCount

  deviceCount
  branchCount
  userCount

  outdatedClientCount

  updatedAt
}
```

Avoid recalculating these by scanning every organization every dashboard load.

---

# 12. Super Admin Dashboard Reads Aggregates

Bad:

```text
Super Admin opens dashboard
↓
Fetch every organization
↓
Fetch every device
↓
Fetch every branch
↓
Calculate totals
```

Preferred:

```text
Super Admin opens dashboard
↓
Fetch platformStats
↓
Fetch small recent-health summary
```

Then drill-down pages can query individual organizations when needed.

---

# 13. Single-Record Drill Down

If Super Admin clicks one organization:

```text
Organization → Details
```

fetch only that organization's relevant platform metadata.

Do not load all organizations again.

Examples:

```text
Plan
Cloud mode
Limits
Usage
Device count
Branch count
User count
Last active
Last backup
App version
Sync health
```

---

# 14. Platform Limits Architecture

Super Admin must be able to manage organization-level platform limits.

Limits must be centralized in Convex because they represent platform entitlements and licensing rules.

Examples:

```text
Maximum users
Maximum devices
Maximum branches
Maximum products
Cloud storage allocation
Cloud backup enabled
Remote monitoring enabled
Cloud sync allowed
Feature capabilities
License expiration
```

Conceptually:

```ts
interface OrganizationLimits {
  maxUsers?: number;
  maxDevices?: number;
  maxBranches?: number;
  maxProducts?: number;

  maxCloudStorageBytes?: number;

  cloudBackupEnabled: boolean;
  remoteMonitoringEnabled: boolean;

  allowedCloudModes: CloudMode[];

  capabilityOverrides?: string[];
}
```

---

# 15. Plan Defaults + Organization Overrides

Do not hardcode limits directly throughout the application.

Use:

```text
Plan Defaults
        +
Organization Overrides
        ↓
Effective Entitlements
```

Example:

```text
PRO DEFAULT

Users: 15
Devices: 15
Products: 5000
Storage: 500 MB
```

Super Admin may override:

```text
Organization A

Users: 25
Storage: 1 GB
```

Then:

```text
effectiveUsersLimit = 25
```

while other Pro organizations remain at 15.

---

# 16. Effective Entitlement Resolver

Create one centralized resolver.

Conceptually:

```ts
resolveOrganizationEntitlements(plan, organizationOverrides);
```

Return:

```ts
{
  (limits, capabilities, allowedCloudModes, cloudFeatures);
}
```

Do not scatter plan checks throughout the UI.

Avoid:

```ts
if (plan === "pro")
```

in arbitrary components.

---

# 17. Limits Must Work Offline

An organization must retain a locally cached copy of its current entitlements.

Store locally:

```text
Plan
Effective limits
Capability entitlements
Cloud mode
License status
Entitlement version
Last verified timestamp
```

This allows Novend to continue functioning offline.

Do not make every product creation, user creation, or branch creation query Convex.

---

# 18. Local Limit Enforcement

Example:

```text
maxUsers = 15
currentUsers = 15
```

Creating another user locally should be prevented immediately.

No Convex request is required.

Similarly:

```text
maxBranches
maxDevices
maxProducts
```

should use locally cached entitlement values.

---

# 19. Server Validation Still Required

When cloud communication occurs, Convex must also validate entitlements.

Local validation is for offline responsiveness.

Server validation protects against manipulated clients.

Therefore:

```text
Local enforcement
+
Cloud enforcement when applicable
```

---

# 20. Entitlement Versioning

Use a version number.

Example:

```ts
entitlementVersion: 14;
```

When Super Admin changes limits:

```text
Version 14
↓
Version 15
```

Clients can compare:

```text
local entitlementVersion
vs
platform entitlementVersion
```

and only download new configuration when necessary.

---

# 21. Efficient Entitlement Refresh

Do not fetch full organization settings on every launch.

Use a lightweight check.

Conceptually:

```text
Client version = 14

Platform:
latest version = 14

Result:
nothing to download
```

If:

```text
Client = 14
Platform = 15
```

then fetch the updated entitlement configuration.

---

# 22. Push Where Appropriate

For `full_sync`, existing subscriptions may receive entitlement changes naturally.

For `backup_only` and `local_only`, use lightweight checks during:

```text
Application launch
Telemetry heartbeat
Manual license refresh
```

Do not create another aggressive polling loop.

---

# 23. Super Admin Limit Updates

Super Admin UI should support:

```text
Organization
↓
Plan & Entitlements
```

Display:

```text
Current Plan

Cloud Mode

Users
12 / 15

Devices
8 / 15

Branches
3 / Unlimited

Products
4,201 / 5,000

Cloud Storage
314 MB / 500 MB
```

Allow authorized Super Admin to override supported limits.

---

# 24. Limit Change Audit

Every Super Admin modification must create an audit record.

Store:

```text
Super Admin
Organization
Previous value
New value
Reason if supplied
Timestamp
```

Platform entitlement changes must be attributable.

---

# 25. Platform Storage Metrics

Do not calculate expensive storage metrics continuously.

Use approximate/cached usage where sufficient.

Update storage usage when:

```text
Backup uploaded
File/image uploaded
Backup deleted
Cloud artifact removed
```

Avoid scanning complete storage repeatedly.

---

# 26. Device Metrics

Do not repeatedly query every device.

Maintain:

```text
organizationId
deviceId
appVersion
lastSeenAt
platform
active
```

A device heartbeat should only update `lastSeenAt` according to the rate limit.

Do not update every few seconds.

---

# 27. Active Organization Definition

Define "active" using telemetry rather than business transactions.

For example:

```text
Active today
=
lastSeenAt within 24 hours
```

This allows `local_only` organizations to count as active without sending business data.

---

# 28. Super Admin Business Visibility

Do not confuse platform analytics with customer business analytics.

A local-only organization should NOT contribute:

```text
Revenue
Profit
Sales totals
Customer counts
Product performance
```

unless the commercial plan explicitly includes remote business monitoring.

Super Admin platform analytics should primarily answer:

```text
Is the organization active?

What plan is it on?

What cloud mode?

How many licensed resources are being used?

What app version?

Is backup healthy?

Is sync healthy?

Are limits being exceeded?
```

---

# 29. Privacy Boundary

Maintain a strict boundary:

```text
PLATFORM TELEMETRY
≠
BUSINESS TELEMETRY
```

Minimal platform telemetry should not leak unnecessary business information.

---

# 30. Updated Cloud Mode Matrix

Use this architecture:

| Capability                 | Full Sync |   Backup Only |  Local Only |
| -------------------------- | --------: | ------------: | ----------: |
| Local POS                  |       Yes |           Yes |         Yes |
| Local analytics            |       Yes |           Yes |         Yes |
| Local reporting            |       Yes |           Yes |         Yes |
| Business-data sync         |  Realtime |     Scheduled |          No |
| Cloud backup               |       Yes |     Scheduled |          No |
| Remote business monitoring |       Yes | Limited/stale |          No |
| Platform telemetry         |   Minimal |       Minimal |     Minimal |
| License checks             |       Yes |           Yes |         Yes |
| Entitlement updates        |       Yes |   Lightweight | Lightweight |
| Platform analytics         |       Yes |           Yes |         Yes |

The word **Minimal** is intentional.

---

# 31. Updated Repository Architecture

Target:

```text
UI
│
├── Business Domain
│      ↓
│   Repository
│      ↓
│    Dexie
│      ↓
│  Business Cloud Policy
│      ├── Full Sync
│      ├── Backup Only
│      └── Local Only
│
└── Platform Service
       ↓
   Telemetry Policy
       ↓
   Entitlement Client
       ↓
   Minimal Convex Operations
```

Do not mix these paths.

---

# 32. Suggested Modules

Adapt names to the current Novend structure.

Conceptually introduce:

```text
cloud-policy
platform-telemetry
entitlements
platform-limits
analytics-local
analytics-platform
```

Do not create duplicate domain layers if equivalent modules already exist.

---

# 33. Telemetry Queue

If telemetry cannot be delivered:

Do not aggressively retry.

Preferred:

```text
Generate latest telemetry state
↓
Offline
↓
Store latest snapshot
↓
Later connectivity
↓
Send latest snapshot
```

Do not retain hundreds of telemetry events.

Platform telemetry is mostly state-based.

Example:

Bad:

```text
USER_COUNT_CHANGED 10 → 11
USER_COUNT_CHANGED 11 → 12
USER_COUNT_CHANGED 12 → 13
```

After offline period.

Preferred:

```text
Current userCount = 13
```

Send one update.

---

# 34. Business Outbox vs Telemetry State

Keep them separate.

```text
Business Outbox
=
must preserve every important business operation
```

```text
Platform Telemetry
=
mostly latest-state synchronization
```

Do not use business-grade event retention for simple platform telemetry.

This will significantly reduce Convex writes.

---

# 35. Metrics Aggregation Strategy

For Super Admin metrics, prefer counters/aggregates updated when platform entities change.

Examples:

When organization created:

```text
organizationCount +1
planCount[plan] +1
cloudModeCount[mode] +1
```

When cloud mode changes:

```text
cloudModeCount[old] -1
cloudModeCount[new] +1
```

When plan changes:

```text
planCount[old] -1
planCount[new] +1
```

Do not scan all organizations just to calculate card totals.

---

# 36. Correctness & Repair

Aggregates are derived state.

The source records remain authoritative.

Provide a Super Admin/internal maintenance action:

```text
Rebuild Platform Analytics
```

that can reconstruct aggregates if needed.

This should be manual/rare.

Do not schedule full rebuilds continuously.

---

# 37. Updated Implementation Sequence

Add these branches to the cloud architecture rollout.

Recommended order:

```text
feat/cloud-mode-foundation

feat/platform-entitlements

feat/platform-telemetry

feat/platform-analytics-aggregates

feat/backup-only-cloud-mode

feat/local-only-cloud-mode

feat/cloud-mode-super-admin

feat/platform-limit-management

feat/local-backup-recovery

refactor/cloud-query-policy
```

---

# 38. Phase: Platform Entitlements

Before `local_only`, implement centralized entitlement architecture.

Validate:

```text
Plan defaults
Organization overrides
Effective limits
Cached local entitlements
Entitlement versions
Local enforcement
Convex enforcement
```

Merge successfully into staging before continuing.

---

# 39. Phase: Platform Telemetry

Implement minimal telemetry separately.

Test:

```text
App opens twice within 24h
→ at most one heartbeat

Nothing changed
→ no unnecessary write

Version changes
→ telemetry updates

Branch count changes
→ one telemetry update

Offline
→ no failure to business operations

Reconnect
→ latest telemetry snapshot sent

local_only
→ no business records uploaded
```

---

# 40. Phase: Platform Analytics Aggregates

Update Super Admin dashboard to read efficient aggregates.

Do not make dashboard cards depend on scanning large collections.

Test:

```text
Organization created
Organization suspended
Plan changed
Cloud mode changed
Device added
Device removed
```

and verify platform metrics adjust correctly.

---

# 41. Phase: Platform Limit Management

Super Admin must be able to safely update:

```text
Plan
Allowed cloud modes
Users limit
Devices limit
Branches limit
Products limit
Storage allocation
Cloud backup entitlement
Remote monitoring entitlement
Capabilities
```

Changes must:

```text
Create audit log
Increment entitlement version
Reach online clients efficiently
Reach offline clients on next lightweight check
Cache locally
Enforce locally
Enforce server-side
```

---

# 42. Minimal Convex Rule

For every platform feature ask:

> Can this metric be derived from one tiny aggregate or one latest-state record instead of repeated queries/writes?

Prefer the minimal option.

Examples:

Bad:

```text
100 devices
×
heartbeat every minute
```

Preferred:

```text
active device
→ heartbeat at most once/day
or on meaningful change
```

Bad:

```text
Super Admin dashboard
→ query all organizations
```

Preferred:

```text
Super Admin dashboard
→ one aggregate record
```

---

# 43. No Unnecessary Reactive Queries

Audit Super Admin React components.

Do not create live subscriptions for information that changes rarely.

Use realtime subscriptions only where realtime behavior is genuinely valuable.

Examples that do not require aggressive realtime:

```text
Plan distribution
Total registered organizations
Lifetime organization count
App version distribution
```

Short-lived caching is acceptable.

---

# 44. Final Architecture

The final system should resemble:

```text
                         NOVEND CLIENT
                               │
              ┌────────────────┴────────────────┐
              │                                 │
       BUSINESS SYSTEM                   PLATFORM SYSTEM
              │                                 │
            Dexie                         Entitlements
              │                          Telemetry State
        Local Analytics                        │
              │                                │
        Business Cloud                   Minimal Platform
            Policy                         Communication
              │                                │
     ┌────────┼────────┐                       │
     │        │        │                       │
   Full     Backup    Local                    │
   Sync      Only     Only                     │
     │        │                                 │
     └────────┴─────────────────────────────────┘
                      │
                    CONVEX
                      │
         ┌────────────┴────────────┐
         │                         │
   Business Cloud            Platform Control
      Data                    + Aggregates
                                   │
                                   ↓
                           SUPER ADMIN
```

---

# 45. Final Principle

Novend must be capable of operating an organization locally without continuously uploading its business activity while still allowing the Novend platform to know the minimum information necessary to:

- validate licenses
- enforce platform limits
- understand organization activity
- monitor supported application versions
- manage cloud modes
- manage plans
- manage entitlements
- detect backup/sync health
- provide useful Super Admin platform analytics

Achieve this with:

```text
Minimal payloads
Event-driven updates
Daily maximum heartbeat where possible
Delta/state comparison
Locally cached entitlements
Platform aggregates
No unnecessary polling
No business-data telemetry for local-only organizations
```

The goal is not **zero Convex usage**.

The goal is:

> **the minimum Convex usage necessary to safely operate, license, manage and monitor the Novend platform.**

Protect business functionality first.

Keep platform telemetry lightweight.

Keep business analytics local.

Keep Super Admin analytics centralized but aggregate-driven.

Do not merge the final `staging → main` PR automatically.
