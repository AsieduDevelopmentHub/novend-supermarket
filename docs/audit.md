# Novend POS Full System Audit

Audit date: 2026-08-25
Repository: `novend-pos`
Audit type: Static code, architecture, release-process, and test-surface review

## Scope and method

Reviewed the Next.js App Router application, Convex functions and schema, authentication and authorization helpers, offline Dexie replica and sync outbox, Paystack billing, cloud backups, Capacitor Android shell, Electron shell, PWA service worker, UI settings and hardware flows, release workflows, tests, and security documentation.

Evidence was gathered from the current working tree and recent release commits. Findings are classified as:

- **Critical**: exploitable tenant/security boundary failure or a release issue that can corrupt or expose customer data.
- **High**: likely account, billing, release, or availability impact requiring prompt remediation.
- **Medium**: material scale, privacy, reliability, or product-completeness risk.
- **Low / Informational**: hardening, documentation, or maintainability improvement.

### Limitations

This is a static review. It did not include live Convex production data inspection, an authenticated penetration test, a malicious two-tenant test against a deployed environment, a production load test, or real-device testing of camera, file picker, touch input, printers, Bluetooth, biometrics, notifications, and service-worker update behavior. No network vulnerability-database scan was performed. A finding marked “confirmed” means the behavior is directly visible in source; exploitability and production impact should still be verified in a safe staging environment.

## Executive summary

Novend has a strong foundation: organization-scoped data modeling, reusable server authorization helpers, substantial input validation, idempotent offline sales and returns, Paystack signature verification, and a thoughtful shared web/Electron/Capacitor architecture. The codebase is beyond a prototype in several core areas.

The current production risk is **High**. Three confirmed cross-tenant write paths must be fixed before onboarding more organizations: product archival, administrator profile editing, and staff provisioning with a foreign branch ID. The custom login lockout is also client-orchestrated and can both be bypassed and abused to lock out arbitrary email addresses. Transaction numbering is race-prone, and native release/update behavior can leave customers on an old APK or stale cached shell.

The main recommendation is to make tenant ownership a mandatory post-`db.get` invariant through shared helpers, add adversarial multi-organization tests, enforce release signing and version/origin checks, and establish production observability and SaaS account-lifecycle controls before scaling customer count.

## Risk summary

| Area                                | Rating      | Main reason                                                                                                                 |
| ----------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| Tenant isolation and authorization  | Critical    | Three cross-organization write paths are confirmed.                                                                         |
| Authentication and abuse resistance | High        | Lockout is client-driven; public failure recording enables denial of service.                                               |
| Billing integrity                   | Medium-High | Strong webhook design, but callback ownership and reconciliation are incomplete.                                            |
| Offline and local data security     | Medium-High | Correct scoping, but local plaintext data and stale offline authority remain.                                               |
| Business correctness and scale      | High        | Invoice, return, and purchase sequences are non-atomic; many full-table scans exist.                                        |
| Mobile/release reliability          | High        | Native changes require a new APK; baked origin, stale shell cache, and debug-sign fallback can confuse or break rollout.    |
| UI/UX and accessibility             | Medium      | Good states and responsive structure, but dense settings and device-specific workflows need testing.                        |
| Operations and compliance           | Medium-High | CI quality checks exist, but no test job, centralized telemetry, security scanning, or formal recovery controls were found. |

## Strengths

### Security and authorization

- `convex/shared/permissions.ts` centralizes `requireAuth`, `requireProfile`, `requireRole`, `requireBranchId`, `assertOrgDoc`, and branch access checks.
- Most tenant queries use organization-first indexes such as `by_organization` and `by_organization_status`.
- Convex validators and `convex/shared/validation.ts` enforce numeric, text, email, phone, SKU, barcode, and image constraints.
- Stored image metadata is checked server-side, including content type and size, and invalid blobs are deleted best-effort.
- `proxy.ts` sends a nonce CSP in production and sets frame, MIME, referrer, and permissions policy headers.
- Completed sales are treated as immutable records and returns are linked to sale lines.

### Offline architecture

- Dexie schema migrations are explicit through replica version 8.
- Replica databases are named by organization and user, reducing accidental sharing between sessions.
- Writes use an outbox and server validation; sale and return operations carry client operation IDs for retry idempotency.
- Inventory, license, and negative-stock checks remain authoritative when an outbox drains to Convex.
- Sync Center, retry states, conflict states, and local/cloud backup separation are visible product concepts.

### Billing and SaaS foundation

- Paystack webhooks use HMAC-SHA512 over the raw body with a timing-safe comparison.
- Payment application is reference-idempotent and funnels subscription changes through shared licensing/subscription helpers.
- Trials, grace windows, plan limits, scheduled downgrades, lifetime plans, manual invoices, and platform administration are represented explicitly.

### Product experience and delivery

- Responsive navigation, role-aware routes, loading/error/empty states, destructive-action confirmations, and offline indicators are present.
- Hardware access is abstracted behind `@novend/hardware`, preserving web/Electron/Capacitor separation.
- Electron uses context isolation, no Node integration, sandboxed renderer settings, and an external-link allow/deny boundary.
- CI runs lint, typecheck, and a production build; release workflows build desktop and Android artifacts and publish Convex release metadata.

## Findings

### Critical

#### C1. Product archive is a cross-tenant write (confirmed)

**Evidence:** [convex/products.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/convex/products.ts), `archiveProduct`.

The mutation authenticates an administrator/manager, loads `args.id`, and patches the product without asserting `product.organizationId === profile.organizationId`. A user who obtains another tenant's product ID can archive it.

**Remediation:** Use `requireOrgDoc` or `assertOrgDoc` immediately after the read. Return a generic not-found error. Add a two-organization IDOR test for every catalog write, not only this mutation.

#### C2. Administrator profile editing lacks target organization and branch ownership checks (confirmed)

**Evidence:** [convex/users.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/convex/users.ts), `updateProfile`.

The mutation reads a target profile by ID but does not compare its organization to the actor's organization. It also accepts a branch ID and checks only that the branch is active. A foreign active branch can therefore be used while patching a foreign profile, changing role, branch, status, and personal fields.

**Remediation:** Assert target profile organization first, assert target branch organization second, then apply role/branch policy. Managers must remain limited to cashiers in their own branch. Add foreign profile and foreign branch tests.

#### C3. Staff provisioning accepts a branch from another organization (confirmed)

**Evidence:** [convex/users.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/convex/users.ts), `createUserAccount` and `insertProfileForUser`.

An administrator's action accepts an arbitrary `branchId`. The internal mutation derives the new profile's organization from that branch, without checking it matches the authenticated administrator's organization. This can create credentials and a staff profile in a different tenant.

**Remediation:** Resolve the actor's organization in the action, require `branch.organizationId === actor.organizationId`, and pass an organization ID only as a consistency assertion, never as client authority. Add tests for administrator, manager, and duplicate-account cases.

### High

#### H1. Login lockout is client-orchestrated and bypassable

**Evidence:** [convex/loginGuards.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/convex/loginGuards.ts) and [features/auth/components/login-form.tsx](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/features/auth/components/login-form.tsx).

The browser calls `assertLoginAllowed`, then calls Convex Auth directly. A malicious client can skip the pre-check and call the auth provider. The custom table is not a server-side gate around password verification.

**Remediation:** Enforce throttling at the authentication/provider or edge layer. Treat the client query as UX only, not a security control. Add rate limits by IP/device/email with privacy-aware logging.

#### H2. Public login-failure recording enables account lockout denial of service

**Evidence:** `recordLoginFailure` in [convex/loginGuards.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/convex/loginGuards.ts).

The unauthenticated mutation accepts any email and increments its failure row. An attacker can submit another customer's email five times and force the custom lockout state.

**Remediation:** Remove the public mutation or make failure recording an auth-provider/server hook. If a client-visible attempt table remains, use a non-authoritative risk signal and never let an unauthenticated caller lock an account.

#### H3. Invoice, return, and purchase references are race-prone

**Evidence:** `nextInvoiceNumber` in [convex/sales.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/convex/sales.ts), `nextReturnNumber` in [convex/shared/returns.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/convex/shared/returns.ts), and purchase counting in [convex/wholesale.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/convex/wholesale.ts).

Each function collects all rows and uses `length + 1001`. Concurrent checkouts can receive duplicate invoice/reference values, and deletions or imports alter numbering. Full-table collection also becomes a latency and function-limit problem.

**Remediation:** Introduce an organization-scoped counter/sequence document allocated transactionally, or use a unique random business reference plus a separate display sequence. Add concurrent mutation tests and database uniqueness checks.

#### H4. `verifyCheckout` has no visible caller ownership check

**Evidence:** `verifyCheckout` in [convex/billing.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/convex/billing.ts).

The public action accepts only a payment reference, verifies it with Paystack, and applies the payment. References are generated with randomness and are not obviously guessable, but the action should still bind the callback to the initiating administrator/organization or deliberately document why an unauthenticated callback is safe and return minimal status.

**Remediation:** Prefer an authenticated callback/session binding where the provider permits it. Otherwise use high-entropy references, verify amount/currency/plan metadata against the stored checkout, minimize response data, and add replay/guessing tests.

#### H5. Bootstrap secrets are callable through public actions without expiry or attempt controls

**Evidence:** `bootstrap` in [convex/platform.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/convex/platform.ts) and related user bootstrap actions.

The secret is environment-backed, which is good, but it is supplied directly to a client-callable action. There is no one-time token, expiry, attempt limit, or explicit post-provisioning disablement. Secret leakage becomes platform-admin compromise.

**Remediation:** Use an operational CLI or one-time bootstrap token, rotate it after use, log attempts without secret values, rate-limit failures, and disable the endpoint after the first platform administrator exists.

#### H6. Native release rollout can leave users on an old or mismatched APK

**Evidence:** [apps/mobile/capacitor.config.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/apps/mobile/capacitor.config.ts), [scripts/write-mobile-boot.mjs](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/scripts/write-mobile-boot.mjs), [packages/hardware/src/adapters/cap-services.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/packages/hardware/src/adapters/cap-services.ts), [components/layout/native-app-services.tsx](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/components/layout/native-app-services.tsx).

The APK bakes `NOVEND_APP_URL`; native plugin and permission changes exist only in a rebuilt APK. The app starts from a local boot page, then a stale-while-revalidate service worker can render cached shell HTML before refreshing. Mobile update checking is a soft prompt with “Later,” not enforcement. The repository contains both `NovendPOS-0.3.3-android.apk` and `NovendPOS-0.3.4-android.apk`, while source Android metadata is version `0.3.4`, versionCode `9`.

**Impact:** A Convex deployment does not update native code. A build made against a different host, an unpurged cache, or an APK not actually reinstalled can continue using old camera/permission behavior. Native camera fixes require installing a new APK; hosted UI/Convex fixes normally do not, provided the APK points at the correct origin.

**Remediation:** Display `App.getInfo()` version/build and hosted release metadata together, log the baked origin, add cache/version diagnostics, make mandatory updates enforceable when required, and document the exact release sequence: build, sign, publish asset, publish Convex metadata, install/upgrade, clear old cache only as a controlled recovery step.

#### H7. Production Android release can fall back to a debug signing key

**Evidence:** [apps/mobile/android/app/build.gradle](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/apps/mobile/android/app/build.gradle) and `.github/workflows/desktop-release.yml`.

If `ANDROID_KEYSTORE_PATH` is absent, the `release` build explicitly uses `signingConfigs.debug`. A debug-signed artifact is not a production release, may fail upgrade over an existing release-signed app, and does not establish release provenance.

**Remediation:** Fail the release job when the keystore is missing. Verify APK signing certificate, versionCode, SHA-256, and package ID before publishing. Keep debug/sideload builds in a separate workflow and channel.

### Medium

#### M1. Middleware authorization fails open on Convex lookup errors

**Evidence:** [proxy.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/proxy.ts).

For privileged pages, a Convex/session lookup failure allows the requested route to render. Backend functions remain the authoritative data boundary, so this is primarily privileged UI exposure rather than direct data access, but it weakens the documented “fail closed” principle and can expose operational screens during an outage.

**Remediation:** Render a restricted error/loading shell when role resolution fails, or limit fail-open behavior to already-loaded non-sensitive shells. Keep all backend checks unchanged.

#### M2. Offline data and backups are plaintext from an end-user device perspective

**Evidence:** [lib/offline/db.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/lib/offline/db.ts), [lib/offline/session.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/lib/offline/session.ts), and [lib/offline/backup.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/lib/offline/backup.ts).

Organization/user naming prevents accidental sharing but is not a security boundary. IndexedDB, localStorage hints, outbox payloads, and exported JSON can expose sales, customers, costs, and cached profile/license data to someone with device/browser-profile access. Android also declares `android:allowBackup="true"`.

**Remediation:** Document the device-possession threat model, encrypt portable backups, use OS secure storage for native key material, consider encrypted sensitive stores, add remote device/session revocation, and review Android backup rules.

#### M3. Offline authorization can remain stale after role, device, or license changes

The cached shell profile can open the app offline after a previous authenticated session. Server sync rejects unauthorized or expired writes, but the local UI may continue to display stale permissions and allow work that later becomes a conflict.

**Remediation:** Store a signed/expiring offline capability with a short TTL, show “offline authority last confirmed” prominently, block high-risk operations after expiry, and test sign-out, role downgrade, device deactivation, organization switch, and license expiry while outbox rows exist.

#### M4. Full-table scans will become a SaaS bottleneck

**Evidence:** `.collect()` scans in [convex/customers.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/convex/customers.ts), [convex/products.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/convex/products.ts), [convex/sales.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/convex/sales.ts), [convex/offline.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/convex/offline.ts), `convex/shared/entitlements.ts`, [convex/platform.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/convex/platform.ts), and `convex/platformAnalytics.ts`.

These are acceptable for small tenants but will increase function duration, memory, and Convex limits as sales and platform history grow.

**Remediation:** Add date-bounded queries, pagination, compound indexes, materialized counters, and performance budgets with large-fixture tests. Do not calculate usage or customer aggregates by repeatedly scanning operational history.

#### M5. Uploaded backup URLs and replaced product images can orphan storage

**Evidence:** [convex/cloudBackups.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/convex/cloudBackups.ts) and product image update paths in [convex/products.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/convex/products.ts).

Upload URLs are issued before metadata/quota recording, so abandoned uploads can remain unreferenced. Product image replacement/clear paths do not consistently delete the previous blob.

**Remediation:** Add unreferenced-object cleanup, ownership metadata, retention windows, and best-effort deletion after successful image replacement.

#### M6. Android data backup and release documentation are inconsistent

The manifest permits backup, while the documented threat model does not address backup extraction. `docs/architecture/CAPACITOR_MOBILE.md` still mentions versionName `0.4.0` even though the current Android build is `0.3.4`, and it contains phase/status language that does not match the implemented ZXing/native flows.

**Remediation:** Make one version source authoritative, validate docs in CI, and decide whether app data backup is allowed for POS records.

#### M7. SaaS account lifecycle controls are incomplete

No clear self-service password reset, email verification, MFA/2FA, passkeys/WebAuthn, account deletion orchestration, data export/delete workflow, owner transfer, invitation acceptance flow, security-event notifications, or complete session inventory/revoke-all UI was found. Admin password reset exists, but it is not a recovery system.

**Remediation:** Prioritize password recovery and email verification, then MFA/passkeys for administrators, organization invitations, owner transfer, account deletion/export, and session/device revocation.

#### M8. Notifications are local-only, not a SaaS delivery system

The notification settings and Capacitor channel/permission code are present, but documentation explicitly describes push delivery as future work. Low stock, billing failure, security, and device events therefore do not have server-side delivery, retry, audit, or unsubscribe guarantees.

**Remediation:** Either narrow the product promise to local alerts or implement in-app/email/push delivery with templates, preferences, retries, delivery logs, and PII controls.

#### M9. Marketing claims exceed clearly implemented functionality

`features/marketing/content.ts` says Excel/CSV import is supported, while repository evidence clearly shows export paths but no equivalent complete import workflow. Mobile availability and future workflows are also described inconsistently across marketing and architecture docs.

**Remediation:** Maintain a feature availability matrix, remove unsupported claims, or implement and test import flows before advertising them.

#### M10. Billing needs reconciliation and operational controls

Webhook verification and idempotency are strong, but there is no clearly exposed reconciliation dashboard for unmatched callbacks, failed webhook retries, refunds/chargebacks, tax/VAT invoice compliance, billing receipts/reminders, customer self-service portal, or an audit timeline for every billing transition. Provider API calls happen in user-facing actions and need resilient retry/job visibility.

**Remediation:** Add payment state reconciliation, dead-letter/retry visibility, refund/chargeback handling, invoice compliance by market, and background jobs for provider synchronization.

#### M11. CI does not execute the test suite or security scans

**Evidence:** [.github/workflows/ci.yml](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/.github/workflows/ci.yml) runs install, lint, typecheck, and build, but not `pnpm test`. No CodeQL, dependency audit/OSV, secret scan, SBOM, or container/build provenance job was found.

**Remediation:** Add unit/integration tests to CI, Convex staging tests, dependency and secret scanning, SBOM generation, artifact signature verification, and protected-branch required checks.

### Low / Informational

#### L1. Unreachable registration code creates misleading behavior

**Evidence:** `registrationStatus` in [convex/users.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/convex/users.ts) returns `{ hasUsers: true }` before its old database check.

Remove the unreachable branch and make the signup/provisioning policy explicit in one place.

#### L2. Deprecated legacy plan mutation remains exposed

**Evidence:** `setOrganizationPlan` in [convex/platform.ts](C:/Users/Asiedu/Desktop/Dev/Software/novend-pos/convex/platform.ts).

Remove it after migration verification, and ensure `organizations.plan` cannot become a second entitlement source of truth beside `planKey` and subscription rows.

#### L3. Error taxonomy and UI recovery need consistency

Several flows use friendly messages, but users should consistently distinguish offline, unauthorized, validation, conflict, server outage, payment pending, and payment failure. This is especially important in Sync Center, billing, camera, and settings.

#### L4. Settings and mobile workflows need usability/accessibility validation

Settings is broad and dense, and mobile actions are grouped under “More.” Add settings search/setup status, business-friendly conflict guidance, keyboard and screen-reader checks, minimum touch-target checks, and visual regression coverage. The reported Settings/Security touch freeze cannot be confirmed from static review; it requires a real-device reproduction matrix.

#### L5. Observability is too console-centric

The codebase has useful local logs but no clear centralized error tracking, PII-scrubbed structured logs, correlation IDs, sync dead-letter metrics, webhook delivery metrics, uptime checks, incident runbook, status page, or backup restore drills.

## Domain reviews

### Security and authentication

Convex Auth password sessions and server-side role helpers are a good base. Password minimum length is eight characters and password change verifies the current password. The main weaknesses are the non-authoritative lockout, lack of recovery and MFA, local “remember email” storage, and fail-open privileged route resolution. Adopt a stronger password policy, breached-password checks where practical, recovery tokens, email verification, MFA/passkeys, and abuse-resistant rate limiting.

### Authorization and multi-tenancy

The intended model is clear: derive organization from the authenticated profile, then enforce role and branch. Most modules follow it. The audit concern is consistency: every direct `ctx.db.get(args.id)` in a write path must be reviewed against the actor organization and, where relevant, branch. Add a reusable IDOR test harness that creates two organizations and exercises every public query/mutation/action with foreign IDs.

### Business logic and functionality

Strengths include immutable completed sales, linked returns, branch stock helpers, FEFO/expiry lots, cost visibility by role, and offline idempotency. Gaps include atomic numbering, concurrency coverage for inventory/returns, cash drawer/session management, end-of-day close and reconciliation, payment refunds, purchase-order maturity, and robust stale-offline conflict handling.

### Offline-first and sync

The replica/outbox design is thoughtful and explicit about Convex as authority. It must be treated as a device-security feature, not a tenant-security boundary. Add encrypted backup/export, capability expiry, organization-switch cleanup, corrupt-migration recovery, quota exhaustion tests, conflict resolution tests, and metrics for pending/failed/dead-letter operations.

### Billing and SaaS

Paystack HMAC verification, reference idempotency, plans, trials, grace, and scheduled changes are strong. Complete the commercial system with reconciliation, refunds/chargebacks, receipts/reminders, tax configuration, customer billing self-service, owner/invitation flows, audit history, and provider retry jobs. Keep one entitlement source of truth and remove legacy plan mutation paths.

### Mobile, desktop, and web runtime

The shared hosted app minimizes duplicated business logic. Electron security settings are good. Capacitor's boot-page pattern is appropriate for offline cold start, but it creates a critical operational requirement: the APK's baked origin, native permissions, versionCode, service worker cache, and Convex release metadata must be verified together. Web camera/photo behavior and native Capacitor camera behavior are different paths; a hosted deployment cannot repair a native plugin bug in an already-installed APK.

### UI/UX and accessibility

Responsive navigation, role-aware settings, empty/loading/error states, confirmation dialogs, and offline status are positives. Improve scanability of Settings, reduce hidden actions under “More,” explain offline conflict consequences in business language, and standardize errors. Run real-device touch testing, keyboard navigation, screen-reader checks, focus trapping, color contrast, and visual regression at web, Android, and Electron viewports.

### Reliability and operations

Add structured logs with request/function IDs, error tracking with PII scrubbing, release/update telemetry, Convex and webhook health checks, sync failure dashboards, audit-log retention, RTO/RPO targets, restore drills, incident response runbooks, and a customer status page. Treat failed webhook and failed outbox operations as operational queues, not only UI states.

### Testing, CI, and dependencies

The repository has 23 test files covering auth/navigation, licensing, subscriptions, offline, barcode, hardware, stock, returns, and payment helpers. The current local baseline reported before this audit was 127 passing tests. Coverage is predominantly unit-level; no comprehensive Convex integration, browser E2E, multi-tenant adversarial, accessibility, load, or real-device hardware suite was found. CI should run the test suite and security scans on every pull request.

### Privacy and compliance

Customer, sales, and staff data are replicated locally and exportable as JSON. Define retention, deletion, export, access-request, breach-notification, audit-log, backup, and subprocessors policies appropriate to Ghana and every market served. Ensure privacy text does not imply recovery, notification, import, or mobile capabilities that are not actually available.

## Prioritized roadmap

### P0: before production/customer scale

1. Fix C1-C3 and add two-organization IDOR tests for all write paths.
2. Replace client lockout with server/provider/edge rate limiting; remove arbitrary public failure recording.
3. Replace invoice/return/purchase count-based numbering with atomic organization-scoped allocation.
4. Enforce release keystore presence; verify APK signature, versionCode, baked origin, and published metadata.
5. Add a release diagnostic screen showing native version/build, hosted origin, Convex environment, service-worker cache version, and latest published mobile release.
6. Run staging tests for camera permission, barcode, photo capture, gallery/file upload, notifications, biometrics, offline cold start, cache update, and Settings touch interactions on supported Android versions.

### P1: next release

1. Add CI test execution, dependency/secret scanning, SBOM, and protected-branch checks.
2. Add billing reconciliation, webhook retry/dead-letter visibility, refunds/chargebacks, and billing audit history.
3. Add password reset, email verification, administrator MFA/passkeys, invitations, and session/device revocation.
4. Add encrypted offline backups, device threat-model documentation, capability expiry, and organization-switch/outbox tests.
5. Add centralized telemetry, error tracking, uptime checks, and restore/incident drills.
6. Remove dead registration code, deprecated plan mutation, stale mobile docs, and unsupported marketing claims.

### P2: product maturity

1. Replace full-table usage and analytics scans with counters, aggregates, pagination, and date-bounded queries.
2. Add cash drawer sessions, end-of-day close, reconciliation, refunds, tax/VAT configuration, and customer billing portal.
3. Add server notification delivery or explicitly limit the product to local notifications.
4. Expand accessibility, visual regression, load, and real-device certification matrices.
5. Add enterprise APIs, webhooks, versioning, rate limits, data export/deletion, owner transfer, and support tooling.

## Suggested verification plan

### Security and tenancy

- Create two organizations with administrator, manager, and cashier accounts.
- Attempt every public query/mutation/action with foreign product, profile, branch, customer, sale, return, backup, device, billing, and organization IDs.
- Verify managers cannot cross branches and administrators cannot cross organizations.
- Test duplicate and replayed operation IDs across users, devices, and organizations.

### Auth and billing

- Bypass the browser and call Convex Auth directly during failed-login tests.
- Attempt arbitrary-email lockout abuse and verify no account denial of service.
- Verify checkout reference ownership, amount/currency/plan matching, callback replay, webhook replay, failed webhook retry, renewal, refund, and chargeback states.

### Offline and scale

- Sign out with pending outbox writes; switch organizations; downgrade a role; deactivate a device; expire a license; then reconnect.
- Corrupt or interrupt Dexie migrations, exhaust quota, restore an invalid backup, and resolve stock/sale conflicts.
- Use large fixtures to measure snapshot, analytics, customer totals, usage counts, and numbering under concurrent writes.

### Runtime and UX

- Test Android versions with camera permission states: first request, denied, permanently denied, system camera in use, offline, and app resume.
- Test barcode scanner open/close/reopen, photo capture, gallery/file upload, notification permission states, biometrics states, Bluetooth printer, and back/deep-link behavior.
- Verify service-worker update from an old cache, hosted deployment against the APK's baked origin, mandatory update behavior, and signed APK upgrade over the previous release.
- Run keyboard, screen-reader, focus, contrast, touch-target, and visual regression checks across web, Electron, and Android.

## Final verdict

Novend has a credible architecture and several production-quality foundations, especially around Convex validation, licensing, billing signatures, offline synchronization, and shared runtime adapters. It is **not ready for broad SaaS scale or security-sensitive multi-tenant production** until the three critical cross-tenant writes, authentication abuse controls, atomic numbering, and signed/native release process are corrected and tested.

The reported “old APK” behavior should be handled as a release-diagnostics problem: verify the installed package versionCode and baked `NOVEND_APP_URL`, confirm the latest mobile metadata is published to Convex, and install the newly signed APK for native camera/permission changes. Hosted Convex/UI changes alone cannot update native code already installed on a device.

No application code was changed during this audit; this file is the only intended deliverable.
