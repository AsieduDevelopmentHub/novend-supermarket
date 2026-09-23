# Novend POS — Audit Gaps and Remediation Plan

**Repository:** `AsieduDevelopmentHub/novend-pos`  
**Reviewed branch:** `main`  
**Audit basis:** Static repository review plus public-site review  
**Audience:** Cursor IDE implementation agent  
**Remediation status:** Updated 23 Sep 2026 (implementation pass)

## Remediation status (this pass)

| ID                        | Status            | Notes                                                                                                                     |
| ------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| P0-1 Electron trust       | **Done**          | `apps/desktop/src/trusted-origin.ts` + IPC/nav/openExternal/media; `tests/desktop-trusted-origin.test.ts`                 |
| P0-2 Capacitor hosts      | **Done**          | Exact-host policy; `*.vercel.app` removed; `pnpm mobile:verify-origin`                                                    |
| P0-3 Local-data security  | **Done (code)**   | Idle lock (default 10m), logout replica tests, threat-model docs. Field-level Dexie encryption + OS keychain **deferred** |
| P0-4 Offline licence      | **Done**          | Fail-closed state machine; recovery/read-only; tests                                                                      |
| P0-5 Auth abuse           | **Done (in-app)** | `loginAttempts` + progressive delay. Edge/WAF evidence, MFA, remote session revoke = **BLOCKED** (ops)                    |
| P0-6 Marketing claims     | **Done**          | Claims corrected; fake logos removed; landing shortened                                                                   |
| P1-1 Desktop signing      | **BLOCKED**       | Needs Authenticode / Apple certs — checklist only                                                                         |
| P1-2 Actions supply chain | **Partial**       | SHA pins + least privilege; SBOM/secret-scanning still open                                                               |
| P1-3 Security headers     | **Done**          | HSTS (prod); header unit tests                                                                                            |
| P1-4 Live IDOR / E2E      | **Open**          | Not in this pass                                                                                                          |
| P1-5 Observability        | **BLOCKED**       | Runbook/checklist only; no Sentry without keys                                                                            |
| P2 Legal                  | **Draft only**    | `SUBPROCESSORS.md`, `DATA_RETENTION_PROPOSAL.md` — **LEGAL REVIEW REQUIRED**                                              |
| UX-1 / UX-2 / UX-3        | **Done**          | Landing path, login back link, clearer outbox conflict labels                                                             |
| RH-1 / RH-2               | **Done**          | gitignore + untracked APKs/store; `SECURITY.md`, `CODEOWNERS`, Dependabot, readiness checklist                            |

**Verification (local, this pass):** `pnpm test` 484 passed; `pnpm typecheck` passed; `pnpm lint` passed; `pnpm build` passed. Full-repo `pnpm format:check` still reports many pre-existing Prettier drifts outside this remediation — format was applied to remediation files.

External controls that must **not** be marked complete without evidence: production WAF/rate-limit proof, code signing, Ghana counsel/VAT, Sentry, restore drills, live two-org adversarial suite.

---

## Objective

Resolve the confirmed security, legal/compliance, reliability, repository-hygiene, and UI/UX gaps listed below without weakening Novend's offline-first architecture.

## Rules for Cursor

1. Work in priority order: **P0 → P1 → P2**.
2. Before changing a finding, inspect every referenced file and its callers.
3. Do not treat client-side route guards as authorization. Convex authorization remains authoritative.
4. Do not remove offline capability merely to simplify a security fix.
5. Add or update tests for every behavioral change.
6. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`, and `pnpm build` before declaring a phase complete.
7. Do not claim an external control—rate limiting, code signing, legal registration, monitoring, backups, or incident response—is complete unless configuration or evidence exists outside source code.
8. Preserve unrelated user changes and document migrations or breaking changes.

---

## P0 — Must Fix Before Broad Production Use

### P0-1. Restrict Electron navigation and IPC to trusted origins

**Risk:** High  
**Files:**

- `apps/desktop/src/window.ts`
- `apps/desktop/src/preload.ts`
- `apps/desktop/src/ipc.ts`
- `apps/desktop/src/customer-display-ipc.ts`
- `apps/desktop/src/customer-display.ts`
- `apps/desktop/src/desktop-config.ts`

**Gap**

The Electron window uses good baseline settings (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`), but it does not prevent top-level navigation to an untrusted origin. IPC handlers also do not validate the sender frame's URL. If the renderer reaches a hostile page, the exposed preload bridge may still provide printing, hardware discovery, customer-display, shell-reload, and update capabilities.

`setWindowOpenHandler` also sends arbitrary URLs to `shell.openExternal` without a protocol/hostname allowlist.

**Required fix**

- Create one reusable trusted-origin policy derived from the configured production app URL.
- Block `will-navigate` when the destination is not:
  - the exact configured Novend origin; or
  - an explicitly required local `file:` URL used by the packaged offline boot page.
- Validate `event.senderFrame.url` or `event.sender.getURL()` in every privileged IPC handler.
- Apply the same sender validation to customer-display IPC.
- Restrict `shell.openExternal` to approved protocols such as `https:` and `mailto:`.
- Do not permit `file:`, `data:`, `javascript:`, custom executable protocols, or protocol-relative URLs as external targets.
- Restrict media permission approval to the trusted Novend origin.
- Validate the `reloadAuthShell` entry against a small allowlist of internal routes. Reject `//host`, encoded external URLs, backslashes, and non-auth routes.

**Acceptance criteria**

- Navigation to `https://example.com`, `//example.com`, `javascript:...`, and unexpected `file:` URLs is denied.
- Privileged IPC invoked from an untrusted sender returns a safe error and performs no action.
- Trusted Novend pages can still print, discover devices, manage customer display, and check updates.
- External `https:` and `mailto:` links open normally; dangerous schemes are rejected.
- Unit tests cover origin normalization, navigation decisions, IPC sender checks, and shell-route validation.

---

### P0-2. Restrict Capacitor navigation to exact owned hosts

**Risk:** High  
**Files:**

- `apps/mobile/capacitor.config.ts`
- `apps/mobile/www/index.html`
- native deep-link/navigation handlers

**Gap**

`allowNavigation` includes `*.vercel.app`. This trusts every application hosted on Vercel, not only Novend. A hostile Vercel page must never run inside the native WebView with access to Capacitor capabilities.

**Required fix**

- Remove `*.vercel.app`.
- Allow only the exact hostname resolved from `NOVEND_APP_URL` plus explicitly listed Novend-controlled production/preview hosts.
- Fail the production mobile build if `NOVEND_APP_URL` is missing, invalid, HTTP, localhost, or an unapproved hostname.
- Keep cleartext and LAN allowances development-only.
- Validate deep-link routes and reject unknown hosts, malformed paths, protocol-relative paths, and arbitrary redirect parameters.

**Acceptance criteria**

- A production build cannot navigate internally to an unrelated `vercel.app` site.
- Development builds still support the documented LAN/emulator workflow.
- A release test prints and verifies the baked application origin.

---

### P0-3. Define and enforce local-data security

**Risk:** High privacy and device-theft exposure  
**Files:**

- `lib/offline/db.ts`
- `lib/offline/session.ts`
- `lib/offline/shell-profile.ts`
- `lib/auth/sign-out.ts`
- `lib/offline/backup.ts`
- `lib/offline/backup-password.ts`
- privacy/security settings components
- Privacy Policy and security documentation

**Gap**

Portable backups are encrypted, but the active Dexie database stores customer, sales, staff, receipt, supplier, inventory, and other business data in plaintext within the browser profile. The marketing statement **“Encrypted and stored securely”** is therefore too broad.

**Required fix**

- Document the local-device threat model clearly.
- Keep full replica deletion on explicit logout and test it.
- Add configurable inactivity locking for shared tills.
- Require reauthentication or biometric/PIN unlock before reopening a locked workspace.
- Minimize sensitive data copied into `localStorage`; prefer IndexedDB or secure native storage where appropriate.
- On native apps, protect local key material using OS secure storage.
- Investigate field-level encryption for the most sensitive cached fields. Do not invent weak custom cryptography.
- If full live-database encryption is deferred, update public claims and the Privacy Policy to accurately state that cloud traffic and exported backups are encrypted while local operational data relies on device/browser security.

**Acceptance criteria**

- Logout removes the bound user's replica, session hints, image cache, and sensitive local keys without deleting another tenant's data.
- A configured idle timeout locks the POS and requires approved reauthentication.
- Documentation distinguishes encryption in transit, encrypted backups, and local device storage.
- Marketing no longer implies that every byte in IndexedDB is encrypted.

---

### P0-4. Make offline licence state fail safely

**Risk:** High business-integrity issue  
**Files:**

- `lib/offline/license-guard.ts`
- `lib/offline/license.ts`
- local sales/returns/product/user/branch repositories
- sync conflict UI

**Gap**

`assertLocalWriteAllowed()` and local-capacity checks return successfully when no cached licence exists. A missing or corrupt cache can therefore allow local operations that appear successful but are later rejected by Convex, producing phantom sales, receipts, or administrative changes.

**Required fix**

- Distinguish these states:
  - first-time installation with no validated licence;
  - valid cached licence;
  - stale licence;
  - corrupt/missing licence after prior activation;
  - explicitly local-only/lifetime mode.
- Require one successful activation before commercial writes are allowed.
- For an established installation with missing/corrupt licence state, enter a recovery/read-only mode instead of failing open.
- Allow only the explicitly designed local-only/lifetime policy to work without periodic cloud licence checks.
- Prevent printing a final-looking receipt for an operation that has not passed the applicable local authority checks.
- Give users a clear recovery message; do not present a future sync rejection as a completed sale.

**Acceptance criteria**

- Deleting or corrupting the licence cache cannot silently enable selling or exceed plan limits.
- Valid local-only organizations can continue indefinitely according to the intended architecture.
- Full-sync and backup-only organizations follow their defined expiry/grace policies.
- Tests cover every licence state and offline transition.

---

### P0-5. Verify real authentication abuse controls

**Risk:** High account-compromise risk  
**Files:**

- `convex/auth.ts`
- `convex/loginGuards.ts`
- `features/auth/components/login-form.tsx`
- authentication deployment/runbook documentation

**Gap**

`assertLoginAllowed` is only a compatibility hint. The source assumes the authentication provider or edge performs throttling, but the repository does not prove that production rate limiting exists.

**Required fix**

- Verify rate limiting by calling the real authentication endpoint directly, bypassing the UI.
- Document confirmed limits and the responsible layer.
- Add account-aware and IP/device-aware abuse controls without enabling trivial denial-of-service against a target email.
- Maintain generic login and password-reset errors to prevent account enumeration.
- Add administrator MFA/passkey support or document it as a release blocker.
- Add session/device inventory and remote session revocation for administrators.

**Acceptance criteria**

- Repeated direct authentication failures are throttled in staging/production.
- Attackers cannot lock another user's account simply by knowing the email address.
- Recovery, OTP, email-change, and login endpoints have independently tested limits.
- The operational evidence is documented; a code comment alone is insufficient.

---

### P0-6. Correct unsupported or misleading public claims

**Risk:** Legal, consumer-trust, and sales risk  
**Files:**

- `features/marketing/content.ts`
- `features/marketing/site-content.ts`
- `features/marketing/components/landing-features.tsx`
- public landing-page components and screenshots
- `overview.md`

**Confirmed mismatches**

| Current claim                                     | Problem                                                                                                           | Required correction                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| “Split payments”                                  | Current sale model records one payment method.                                                                    | Implement true split tenders or remove the claim.                            |
| “Outstanding balances”                            | Appears in marketing/overview, but no confirmed customer-ledger implementation was found.                         | Implement credit/ledger workflows or remove it.                              |
| “Encrypted and stored securely”                   | Live Dexie data is not generally encrypted.                                                                       | Use precise encryption/storage language.                                     |
| “100% operational without internet”               | Initial activation, sign-in, billing, privacy/account actions, and some recovery operations require connectivity. | Say “core selling and local operations continue offline after setup.”        |
| “Real-time dashboards”                            | Backup-only and local-only modes are not real-time cloud sync.                                                    | Say “locally updated” or “updates after synchronization,” depending on mode. |
| “Trusted by growing businesses” with named brands | Names appear hard-coded; authorization was not established.                                                       | Remove them unless they are real customers with written permission.          |
| “Explore Pharmacy Demo”                           | Link returns to `#how-it-works`, not a pharmacy demo.                                                             | Build a real demo route or rename the CTA.                                   |

**Acceptance criteria**

- Every advertised feature maps to a verified implementation and plan.
- Claims remain accurate for full-sync, backup-only, and local-only modes.
- Customer names/logos are used only with documented permission.
- Pricing, plan limits, cloud storage, device limits, update duration, and lifetime terms match the entitlement constants and legal terms.

---

## P1 — Security, Release, and Reliability Hardening

### P1-1. Add signed desktop releases

**Files:**

- `.github/workflows/desktop-release.yml`
- `apps/desktop/package.json`
- desktop release documentation

**Gap**

The release workflow disables certificate auto-discovery and does not show Windows Authenticode or Apple Developer ID signing/notarization.

**Fix**

- Sign Windows installers and executables.
- Sign and notarize macOS builds.
- Fail release jobs when required signing credentials are absent.
- Verify signatures before publishing release metadata.
- Publish SHA-256 checksums for every installer.

---

### P1-2. Harden GitHub Actions supply-chain controls

**Files:** `.github/workflows/*.yml`, `.github/actions/**`

**Fix**

- Pin third-party actions to full commit SHAs, retaining version comments.
- Set minimal `permissions` per job instead of workflow-wide write permissions.
- Add dependency review, secret scanning, and an SBOM release artifact.
- Add Dependabot or an equivalent scheduled update process.
- Ensure pull requests from untrusted forks never receive release secrets.

---

### P1-3. Add missing security headers

**File:** `proxy.ts`

**Fix**

- Add production-only `Strict-Transport-Security` with an appropriate max age after confirming all production subdomains use HTTPS.
- Evaluate `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, and `Cross-Origin-Embedder-Policy` for compatibility.
- Keep the CSP nonce approach.
- Gradually remove `style-src 'unsafe-inline'` if the UI stack permits it.
- Add automated response-header tests for public and authenticated routes.

---

### P1-4. Build real integration and E2E security tests

**Gap**

The repository has many useful Vitest tests, but no confirmed Playwright/E2E, accessibility, visual-regression, or live two-tenant adversarial suite.

**Required suites**

- Two organizations, each with administrator, manager, and cashier accounts.
- Attempt foreign IDs across products, customers, branches, users, sales, returns, storage, backups, devices, billing, payroll, expenses, and imports.
- Managers must not cross branches; cashiers must not access other cashiers' restricted records.
- Duplicate/replayed client operation IDs across users, organizations, and devices.
- Concurrent sales against the same remaining stock.
- Concurrent returns against the same sale item.
- Offline sale followed by suspension, role downgrade, device revocation, and stock conflict.
- Keyboard-only checkout and settings flows.
- Screen-reader names, focus trapping, contrast, touch targets, mobile overflow, and reduced-motion behavior.

---

### P1-5. Improve operational observability

**Fix**

- Add centralized, PII-scrubbed error reporting.
- Attach correlation IDs to sync batches, billing events, import jobs, and releases.
- Track outbox pending/failed/dead-letter counts.
- Track webhook delivery/reconciliation failures.
- Add uptime checks, backup-restore drills, RTO/RPO targets, an incident runbook, and a status page.
- Never place passwords, tokens, complete receipt/customer payloads, or sensitive local data in logs.

---

## P2 — Legal and Compliance Completion

> These items require legal/accounting decisions. Cursor may prepare content and checklists, but must not mark them legally approved.

### P2-1. Publish a concrete subprocessor list

Include each provider's legal name, purpose, data categories, hosting/processing region where known, and change-notification process. Review at least Convex, Vercel, Resend, Paystack, GitHub release infrastructure, analytics/error monitoring, and support tools.

### P2-2. Define exact retention periods

Replace vague phrases such as “commercially reasonable period” and “limited rolling window” with approved periods for:

- active customer data;
- closed organizations;
- encrypted backups;
- audit logs;
- authentication/security logs;
- billing records;
- support communications;
- failed imports/uploads;
- telemetry and device presence.

### P2-3. Ghana-specific privacy and business review

- Confirm the contracting legal entity and publish its formal service address.
- Confirm Ghana Data Protection Commission registration obligations.
- Explain data-subject rights and complaint/escalation routes under applicable Ghanaian law.
- Confirm tax/VAT invoice and receipt requirements with an accountant or lawyer.
- Clarify which party is controller versus processor for customers, staff, suppliers, payroll, and platform telemetry.

### P2-4. Employee and payroll privacy

Create an appropriate notice and permission model for salary, commission, attendance/presence, performance, and payroll data. Restrict access, exports, audit logs, and retention separately from ordinary POS customer data.

---

## P2 — UI/UX Improvements

### UX-1. Shorten the landing-page decision path

- Reduce repeated offline/download/trial messages.
- Keep the flow: hero → offline advantage → core product screens → industries → pricing → final CTA.
- Limit the main showcase to the strongest five screens.
- Keep plan comparisons scannable on mobile.

### UX-2. Improve login navigation

- Add a clear “Back to website” link.
- Preserve the existing forgot-password and staff-account explanation.
- Validate focus order, autofill, password-manager behavior, error announcements, and reduced motion.

### UX-3. Make offline conflicts understandable

- Never show a rejected synced sale as a generic technical error.
- Explain the affected receipt, product, requested quantity, accepted quantity, current stock, and resolution choices.
- Separate retryable network errors from permanent business conflicts.
- Provide a manager-review queue for unresolved operations.

### UX-4. Test dense settings and tables on real mobile devices

- Convert wide data tables to cards or intentionally scrollable regions.
- Remove nested/double vertical scrollbars.
- Maintain minimum touch targets.
- Keep primary actions visible above mobile keyboards.
- Test Android WebView, iOS PWA, desktop Electron, and narrow browser widths.

---

## Repository Hygiene

### RH-1. Remove generated/cache files and release binaries from source control

**Confirmed tracked items:**

- `.pnpm-store/v11/index.db`
- root APK release files such as `NovendPOS-0.3.3-android.apk` and `NovendPOS-0.3.4-android.apk`

**Fix**

- Add `.pnpm-store/` and root release patterns to `.gitignore`.
- Publish APKs/installers through GitHub Releases only.
- Remove tracked copies in a normal commit.
- If repository size is a serious problem, propose a separate, carefully reviewed history-cleanup operation. Do not rewrite shared history automatically.

### RH-2. Add governance files

- `SECURITY.md` with private vulnerability-reporting instructions.
- `CODEOWNERS` for sensitive paths.
- Dependency-update configuration.
- A production-readiness checklist referencing signing, migrations, backups, tenancy, offline conflicts, billing, and legal approval.

---

## Suggested Implementation Phases

### Phase 1 — Native trust boundaries

1. Electron origin/navigation policy.
2. Electron IPC sender validation.
3. External-link scheme allowlist.
4. Capacitor exact-host policy.
5. Tests for all trust-boundary decisions.

### Phase 2 — Offline authority and local privacy

1. Licence-state machine and recovery mode.
2. Idle locking and secure native key storage.
3. Logout/organization-switch cleanup tests.
4. Update privacy and marketing wording.

### Phase 3 — Authentication and tenancy verification

1. Prove production throttling.
2. Add MFA/session revocation.
3. Build live two-organization IDOR tests.
4. Add concurrent stock/return tests.

### Phase 4 — Releases and CI

1. Desktop signing/notarization.
2. SHA-pinned GitHub Actions and least privilege.
3. SBOM, secret scanning, dependency review, and checksums.
4. Remove tracked binaries/cache.

### Phase 5 — UI, legal, and operational readiness

1. Correct marketing claims.
2. Add Playwright accessibility and visual regression coverage.
3. Finalize subprocessors, retention, and Ghana-specific review.
4. Add monitoring, incident response, and restore drills.

---

## Final Verification Matrix

Cursor must produce a final report containing:

| Check                | Required evidence                                               |
| -------------------- | --------------------------------------------------------------- |
| Lint                 | `pnpm lint` result                                              |
| TypeScript           | `pnpm typecheck` result                                         |
| Unit tests           | `pnpm test` result and test count                               |
| Formatting           | `pnpm format:check` result                                      |
| Production build     | `pnpm build` result                                             |
| Electron boundary    | Automated navigation and IPC sender tests                       |
| Capacitor boundary   | Production host-validation test                                 |
| Offline licensing    | State-matrix tests                                              |
| Tenant isolation     | Live two-organization adversarial results                       |
| Concurrent inventory | Parallel sale/return results                                    |
| Accessibility        | Automated scan plus keyboard/manual checklist                   |
| Desktop release      | Signature and checksum verification                             |
| Android release      | Signature, version, origin, and checksum verification           |
| Legal                | Human approval status, not an automated “passed” label          |
| Operations           | Monitoring, recovery, and incident evidence or explicit blocker |

## Definition of Done

The work is complete only when:

- P0 findings are fixed and tested.
- No native wrapper grants privileged capabilities to an untrusted origin.
- Missing/corrupt licence state cannot produce deceptive completed offline operations.
- Public claims match actual behavior and entitlements.
- Cross-tenant and cross-branch access is tested against a deployed staging backend.
- Release artifacts are signed and verified.
- Remaining legal or operational dependencies are explicitly documented as blockers rather than marked complete.
