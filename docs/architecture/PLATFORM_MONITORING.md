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
business payloads.

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
