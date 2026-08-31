# Audit Implementation

Implementation date: 2026-08-25  
Source audit: [`audit.md`](./audit.md)  
Convex dev deployment: `asiedudevelopmenthub:novend-pos-39a7a:dev/cloud`

## Completed Controls

| Audit items | Implementation                                                                                                                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1-C3       | Product archive, profile editing, branch assignment, and internal staff provisioning now assert the authenticated organization and active branch ownership. Foreign IDs return generic not-found/invalid-branch errors. |
| H1-H2       | Removed unauthenticated login-failure writes and client lockout orchestration. Password verification remains in Convex Auth; edge/provider throttling is the security boundary.                                         |
| H3          | Invoice, return, and purchase references use collision-checked cryptographic identifiers instead of full-table `length + 1001` allocation.                                                                              |
| H4          | Checkout callback verification requires the authenticated organization administrator who initiated the checkout, matches the stored reference, amount, currency, and gateway response, and remains replay-idempotent.   |
| H5          | Platform and administrator bootstrap actions require explicit `BOOTSTRAP_*_ENABLED=true`, a secret, and refuse after an administrator exists. Disable the flag after provisioning.                                      |
| H6          | Mobile update payloads support mandatory updates. The native dialog shows installed version/build and hosted origin; mandatory updates cannot be dismissed.                                                             |
| H7          | Android release signing requires a real keystore and credentials when building release. CI verifies APK signature, package/version metadata, and publishes a SHA-256 checksum.                                          |
| M1          | Privileged middleware resolution now fails closed on Convex/session errors. Backend authorization remains authoritative.                                                                                                |
| M2-M3       | Android backup/device transfer is disabled for POS data. Portable backups are encrypted with PBKDF2 + AES-GCM and organization-bound. Offline authority expires after 24 hours and stale session hints are cleared.     |
| M5          | Product image replacement/clear paths delete the previous storage blob best-effort after metadata is updated. Cloud backup uploads remain quota/ownership checked.                                                      |
| M6, M9      | Mobile version documentation now points to package/release authority. Unsupported self-service Excel/CSV import marketing claims were removed.                                                                          |
| M10         | Hourly and daily pending Paystack reconciliation retries provider verification, validates amount/currency, abandons stale attempts, and exposes pending/stale/failed counts in Platform Health.                         |
| M11         | CI now runs tests, dependency audit, formatting/diff checks, and tracked-secret scanning.                                                                                                                               |
| L1-L2       | Unreachable registration logic and deprecated `setOrganizationPlan` mutation were removed.                                                                                                                              |

## Production Gates

The following audit items require external operational systems or evidence and are deliberately not represented as completed by source edits alone:

- Password reset email delivery, email verification, administrator MFA/passkeys, invitation acceptance, owner transfer, account deletion/export, and session inventory require a configured email/identity provider and staging acceptance tests.
- Centralized PII-scrubbed telemetry, error tracking, uptime/status monitoring, incident response, backup restore drills, and RTO/RPO require production service configuration and an on-call owner.
- Push/email notification delivery requires a provider, templates, consent/preferences, retry/dead-letter handling, and unsubscribe tests. Current product promises remain limited to local/in-app notifications.
- Tax/VAT invoices, refunds/chargebacks, retention/deletion requests, subprocessors, and market-specific privacy terms require legal/accounting decisions.
- Multi-tenant adversarial, load, accessibility, and Android hardware certification require staging fixtures, browsers, supported devices, printers, scanners, camera permissions, and a release test matrix.

## Verification

- Convex dev deployment completed successfully and added `billingHistory.by_status_gateway_createdAt`.
- `vitest`: 23 files, 130 tests passed.
- Local ESLint passed after correcting the route-sheet effect annotations.
- Local TypeScript passed after Convex code generation against the dev deployment.
- Production `next build` passed with network access for `next/font` asset resolution.
- Android release workflow now refuses unsigned/debug fallback artifacts.
- Local Android signing variables are documented in `.env.example`, a repeatable
  `pnpm mobile:build:android:release` helper validates them, and tag CI now fails fast when
  the protected keystore secret is absent.

## Release Checklist

1. Set `NOVEND_APP_URL` and Convex production URL explicitly during mobile sync.
2. Set `ANDROID_KEYSTORE_BASE64`, keystore password, alias, and key password in protected CI secrets.
3. Build and install the signed APK; verify package, versionCode/versionName, checksum, baked origin, and Convex mobile metadata.
4. Publish the mobile release metadata and mark `mandatory=true` only when the minimum supported version is ready.
5. Disable `BOOTSTRAP_PLATFORM_ENABLED` / `BOOTSTRAP_ADMIN_ENABLED` after first provisioning.
6. Run the staging device, billing webhook, multi-tenant IDOR, backup restore, accessibility, and recovery checks before customer scale.

## 2026-08-31 sanitization pass

Source: in-repo review of unused modules, tenant isolation, and Convex read cost.
New indexes require a Convex deploy before production uses them.

### Removed

Unused modules and assets: `lib/sanitize.ts`, `constants/journey-step-frame.ts`,
`components/desktop-install-banner.tsx`, `components/offline/offline-admin-shell.tsx`,
dead marketing hero stages (`landing-atmosphere`, `landing-dashboard-stage`,
`landing-pos-stage`, `use-landing-hero-parallax`), `services/index.ts`, and the
superseded v3 hero PNG. Presence and `roundMoney` client helpers now share one
implementation.

### Security

| Item                  | Change                                                                                |
| --------------------- | ------------------------------------------------------------------------------------- |
| Cost price on returns | `returns.preview` omits `unitCost` unless `canViewCostPrice`                          |
| Document uniqueness   | Return numbers and purchase references are unique per organization                    |
| Profile insert        | `insertProfileForUser` requires `organizationId` and matching branch                  |
| Business settings     | `settings.getBusiness` is administrator/manager only                                  |
| Paystack activation   | `applySuccessfulPayment` refuses to activate without an existing `billingHistory` row |
| Login probe           | Public `registrationStatus` query removed from the login form                         |

### Convex read cost

- `collectSalesInCompletedAtRange` / `collectExpensesInOccurredAtRange` /
  `collectSaleItemsForSales` in `convex/shared/salesRange.ts`
- `sales.listOrders` uses `.take(fetchCap)` on `by_organization_completedAt`
- Analytics COGS uses one org `products` collect instead of per-product `db.get`

### Still open

- Live two-organization IDOR suite
- Platform dashboard full-table collects (`platform.ts`, `platformAnalytics.ts`,
  `platformMonitoring.ts`)
- `offline.getSnapshot` remains a bulk hydrate by design
- Login / bootstrap brute-force depends on Convex Auth and edge throttling
- `convex/dashboard.ts` is unused by the app UI (Dexie-backed dashboard); left
  in place but now range-indexed so a future subscriber is cheap
