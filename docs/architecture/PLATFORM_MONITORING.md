# Platform Monitoring

## Purpose

The Super Admin monitoring suite provides product, commercial, release, and
operational visibility across Novend without exposing tenant business payloads.
It is available only through Convex functions guarded by `requirePlatformAdmin`.

## Privacy boundary

Telemetry stores only internal user and organization identifiers plus
allowlisted dimensions:

- runtime and delivery mode;
- app and release version;
- feature and workflow codes;
- sanitized error codes;
- event counts and timestamps.

It does not store names, email addresses, IP addresses, user-agent strings,
stack traces, search text, sale lines, products, customers, or payment payloads.
Client timestamps are clamped to a narrow ingestion window.

Monitoring KPI cards on `/platform` open `/platform/insights/[metric]` for
MRR, active organizations, MAU, downloads, devices, gross revenue, staff
accounts, and client errors. Detail queries reuse `getInsightDetail` and the
Dexie platform insight cache.

Client-error rows on `/platform/insights/client-errors` open
`/platform/insights/client-errors/[code]` (for example `runtime:android` or
`feature:settings`). That screen lists recent `platformEvents` for the
dimension plus breakdowns by fingerprint, runtime, feature, and app version.
Events remain privacy-limited: no messages, stacks, or paths. Fingerprints are
allowlisted codes such as `window_error.TypeError`.

## Metrics

- DAU, WAU, and MAU count distinct authenticated users.
- Active organizations count organizations with at least one daily active user.
- Runtime mix counts active licensed devices as Web, PWA, Electron, Android, or
  iOS.
- Feature adoption is an event count, not a business-record count.
- Client errors are sanitized category codes.
- Sync failures count failed outbox items reported by clients.
- MRR normalizes yearly recurring subscriptions to a monthly value. Lifetime
  licences do not contribute to MRR.

## Downloads

Installer asset redirects record one event before redirecting to GitHub. Update
manifests are measured separately from installer downloads. Existing GitHub
asset totals can be imported once as an immutable historical baseline. The
dashboard displays the baseline plus Novend-tracked downloads and discloses the
tracking start date.

The redirect must succeed even when telemetry recording fails.

## Retention and aggregation

`platformEvents` and `platformDailyActiveUsers` retain detailed pseudonymous
rows for 90 days. Nightly maintenance deletes expired rows in bounded batches.
`platformDailyRollups` is durable and powers range queries without retaining
business payloads. Sale completions also increment a `sale_completed` rollup
dimension for Super Admin trend cards.

Tenant list and overview screens read `organizationPlatformStats` (per-org
counters) instead of collecting every sale or product document. After deploying
the table, run `platformStats.backfillOrganizationStats` in pages until
`isDone` so historical orgs have accurate counters.

**Cloud query policy.** Super Admin overview KPI cards prefer aggregates over
`.collect()`. Deployment-wide totals (organization / cloud-mode / plan / device /
branch / user counts) come from the `platformStats` singleton via
`platformStats.getGlobal`, maintained incrementally on org write paths and
repairable with `platformStats.rebuild`. Reserve full-table scans for near-cap
lists and recent-org drill-downs, not headline cards.

Runtime mix and device health query only **active** devices (`by_isActive`).
Activation funnel registrations use `by_registeredAt` for the selected range.
Staff account totals come from `organizationPlatformStats` (no global profiles
collect).

## Offline behavior

The client batches allowlisted events in local storage and flushes them after
reconnection. The queue is bounded at 200 rows. Monitoring snapshots are cached
in Dexie for offline executive review; detailed activity remains online-only.

## Exports

Platform exports are Super Admin-only and bypass tenant plan gates:

- branded executive PDF;
- multi-sheet XLSX workbook;
- executive CSV.

Every online platform export records both a telemetry event and an immutable
audit action. Reports include range, generation time, and download-baseline
disclosures.
