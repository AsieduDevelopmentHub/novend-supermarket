# Production readiness checklist

Use this before broad production traffic. Items marked **BLOCKED** need evidence
outside this repository (credentials, legal sign-off, vendor consoles, or
operational drills). Do **not** treat a checked box in source control as proof
those external controls exist.

Related: `docs/architecture/NOVEND_AUDIT_GAPS_AND_FIXES.md`, `SECURITY.md`.

## Status legend

| Status      | Meaning                                        |
| ----------- | ---------------------------------------------- |
| DONE (code) | Implemented and testable in this repo          |
| DRAFT       | Scaffolding / proposal only — not approved     |
| BLOCKED     | Waiting on external evidence or human approval |

---

## Release signing & provenance

| Item                                                     | Status          | Notes                                                                                                                                       |
| -------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows Authenticode signing for Electron installers/exe | **BLOCKED**     | Workflow still sets `CSC_IDENTITY_AUTO_DISCOVERY: false`. No cert/evidence in repo. (P1-1)                                                  |
| macOS Developer ID signing + notarization                | **BLOCKED**     | Same as above. (P1-1)                                                                                                                       |
| Fail release when signing credentials absent (desktop)   | **BLOCKED**     | Android keystore gate exists; desktop signing gate does not.                                                                                |
| Publish SHA-256 checksums for every installer            | DRAFT / partial | Android APK checksum artifact exists; desktop checksum publication not complete.                                                            |
| Android release APK signing                              | DONE (code)     | Release job requires keystore secrets and verifies with `apksigner`. Still verify secrets are present in the production GitHub environment. |

## Migrations & data integrity

| Item                                               | Status      | Notes                                          |
| -------------------------------------------------- | ----------- | ---------------------------------------------- |
| Convex schema migration plan for breaking changes  | DRAFT       | Document per-release; no automatic proof here. |
| Backup / restore drill with RTO/RPO targets        | **BLOCKED** | Needs operational evidence.                    |
| Tenant isolation adversarial tests against staging | **BLOCKED** | Needs live two-org suite (P1-4). Unit-level guards exist: `tests/idor-tenancy.test.ts`, `tests/idor-tenant-isolation.test.ts` (credit, price lists, wholesale). |
| Customer credit ledger, split tenders, price lists | DONE (code) | Convex-enforced limit/capability/org checks; see `docs/business/CUSTOMERS_CREDIT_WORKFLOW.md`. Real-deployment concurrency evidence **BLOCKED**. |

## Tenancy & authorization

| Item                                             | Status      | Notes                             |
| ------------------------------------------------ | ----------- | --------------------------------- |
| Org assertion after `db.get` on business records | DONE (code) | Continuously re-verify in review. |
| Client route guards never treated as authz       | DONE (code) | Convex remains authoritative.     |

## Offline & sync

| Item                                                     | Status                | Notes                                                                    |
| -------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------ |
| Offline licence fail-safe (no phantom sales)             | DONE (code) / verify  | Confirm state-matrix tests stay green.                                   |
| Sync conflict UX separates network vs business rejection | DONE (code) / partial | Sync center humanizes conflicts; manager review queue still open (UX-3). |
| Concurrent stock / return stress tests                   | **BLOCKED**           | Needs staging harness (P1-4). Pure-rule tests (oversell, credit over-limit) in `tests/concurrent-stock-credit.test.ts` do not replace it. |
| Credit, price-list and warehouse-lot offline replica     | DONE (code) / verify  | Dexie v15, snapshot, outbox ops, conflict labels covered by unit tests. Real-device offline run **BLOCKED**. |

## Billing

| Item                                               | Status      | Notes                                                                |
| -------------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| Webhook ownership, replay, reconciliation runbook  | DRAFT       | See `docs/architecture/BILLING.md`. Production evidence **BLOCKED**. |
| Paystack / provider console access + alert routing | **BLOCKED** | External.                                                            |

## Security headers & supply chain

| Item                                            | Status                | Notes                                                                     |
| ----------------------------------------------- | --------------------- | ------------------------------------------------------------------------- |
| CSP nonce + baseline headers in `proxy.ts`      | DONE (code)           |                                                                           |
| Production HSTS                                 | DONE (code)           | Confirm every production hostname serves HTTPS before enabling preload.   |
| COOP / CORP                                     | DONE (code)           | COEP deferred — see security guide.                                       |
| Actions pinned to commit SHAs + least privilege | DONE (code) / partial | Pinned critical third-party actions; expand SBOM/dependency-review later. |
| Dependabot                                      | DONE (code)           | `.github/dependabot.yml`                                                  |
| Secret scanning / dependency review / SBOM      | **BLOCKED**           | Needs GitHub org settings + workflow additions.                           |

## Observability (P1-5)

| Item                                                   | Status      | Notes                                                                                                 |
| ------------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------- |
| Centralized PII-scrubbed error reporting (e.g. Sentry) | **WIRED**   | `@sentry/nextjs` opt-in via `NEXT_PUBLIC_SENTRY_DSN`; auth headers stripped. See `docs/architecture/OPS_INTEGRATIONS.md`. Production evidence still needs a live DSN. |
| Uptime checks, status page, incident runbook           | **BLOCKED** | Operational.                                                                                          |
| Outbox / webhook failure dashboards                    | DRAFT       | Metrics design only.                                                                                  |

### Observability next step (production evidence)

1. Create a Sentry project and set `NEXT_PUBLIC_SENTRY_DSN` on Vercel (SDK is already wired; unset = dormant).
2. Confirm PII scrubbing in practice: no passwords, tokens, full receipts, customer PII, or local replica dumps.
3. Attach release version + correlation IDs for sync batches and billing events.
4. Document the project URL here once a production DSN is live.

## Legal & compliance (P2)

| Item                                        | Status         | Notes                                                                      |
| ------------------------------------------- | -------------- | -------------------------------------------------------------------------- |
| Subprocessor list                           | DRAFT          | `docs/architecture/SUBPROCESSORS.md` — **LEGAL REVIEW REQUIRED**           |
| Exact retention periods                     | DRAFT          | `docs/architecture/DATA_RETENTION_PROPOSAL.md` — **LEGAL REVIEW REQUIRED** |
| Ghana Data Protection / entity / VAT review | **BLOCKED**    | Counsel + accountant.                                                      |
| Employee / payroll privacy notice           | **BLOCKED**    | Counsel.                                                                   |
| Marketing claims match shipped features     | DRAFT / verify | Audit P0-6.                                                                |

## Repository hygiene

| Item                                    | Status      | Notes                                                          |
| --------------------------------------- | ----------- | -------------------------------------------------------------- |
| `.pnpm-store/` and root APKs not in git | DONE (code) | Ignored + removed from index; history cleanup optional.        |
| `SECURITY.md` + `CODEOWNERS`            | DONE (code) | Ensure GitHub team `@AsieduDevelopmentHub/maintainers` exists. |

## Sign-off

| Role        | Name | Date | Result                                       |
| ----------- | ---- | ---- | -------------------------------------------- |
| Engineering |      |      |                                              |
| Security    |      |      |                                              |
| Legal       |      |      | **BLOCKED** until drafts approved            |
| Operations  |      |      | **BLOCKED** until drills/monitoring evidence |
