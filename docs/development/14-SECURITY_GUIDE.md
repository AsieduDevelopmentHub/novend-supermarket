# Novend POS

## Security Guide

Version: 1.2.0

Related: Convex guide, Constitution §10, `docs/architecture/MULTI_TENANT.md`

# Principles

- Security is designed in, not bolted on
- Never trust the client
- Least privilege for every role
- Assume hostile input on every public function
- Fail closed

# Authentication

- Convex Auth Password provider with Next.js cookie sessions. See
  `docs/architecture/AUTHENTICATION.md`.
- Public **signup** is enabled for organization owners only (`/signup` →
  `/onboarding`). Staff cannot self-provision a profile.
- Staff accounts are created by in-org administrators (or managers for cashiers)
- Login is enforced around the Convex Auth Password provider, including direct
  `auth:signIn` calls: 5 failures per email + installation key in 15 minutes →
  15-minute lockout. Failed attempts across installation keys increase the same
  email's progressive 250 ms–2 second server delay, but do not hard-lock a
  different installation.
- Password reset is hashed, single-use, and expires in one hour
  (`/forgot-password`). Reset delivery is limited to once per minute and five
  times per hour per existing account, with a generic response. Do not add a
  second recovery system.
- Email verification is a **soft**, server-owned 6-digit OTP. It does not block
  signup, onboarding, or POS. Checkout requires a verified email. See
  AUTHENTICATION.md. OTP delivery is limited to once per minute/eight per hour,
  with five code attempts. Email-change current-password checks use the same
  5-in-15-minute lockout policy. Social login is **not** in this slice.
- `proxy.ts` enforces auth on app routes; Convex remains the API source of truth
- First session on a device requires network; later offline refresh uses a
  cached shell profile

### Boundary of the in-app controls

The installation key is a random local identifier. It reduces trivial
email-only denial of service but is not device attestation and can be rotated
by an attacker. Per-email delay raises the cost of rotation. The provider's
default account-only hard limiter is configured out of the practical path
because it would let an attacker lock a victim by email alone. Convex Auth
actions do not provide this wrapper with a trustworthy source IP, so IP,
network, ASN, and distributed-bot controls require separately configured and
tested edge/WAF enforcement.

No production/staging edge-rate-limit evidence is stored in this repository.
Direct endpoint verification and retained operational evidence are a release
blocker. Administrator MFA/passkeys and remote Convex Auth session inventory
and revocation are also release blockers / P1 follow-up; ordinary device
deactivation is not equivalent to auth-session revocation.

# Authorization

Every Convex query/mutation/action that touches business data must:

1. Authenticate
2. Resolve organization from the session profile
3. Authorize role / branch
4. Validate input
5. Enforce business rules
6. After `db.get`, assert `organizationId`

Hiding a button is not authorization.

| Role          | Capabilities                                                                        |
| ------------- | ----------------------------------------------------------------------------------- |
| Cashier       | Sales, hold/resume, receipts, own orders/returns, customer lookup                   |
| Manager       | Branch ops, catalog, inventory, cashiers in branch, staff performance (not payroll) |
| Administrator | Organization-wide, including users, settings, salary/commission (Pro+)              |
| Owner         | Administrator + cannot be deactivated in this slice                                 |

A user cannot set their own account inactive. A signed-in (online) account
cannot be set inactive until they sign out. Convex enforces both; hiding the
control is not authorization. Deactivation is a soft archive: sales and financial
history keep the employee reference.

Payroll (set salary, record salary/commission payments, staff month roster) is
administrator-only and plan-gated (`canManageStaffCompensation`, Pro and above).
Managers can open the user command center for performance but cannot change
compensation. Do not scatter `if (role === "administrator")` in screens — use
`usePermissions().canManagePayroll` and `useLicense().capabilities`.

# Tenant isolation

- Never accept `organizationId` from the client as authority
- SKU / invoice uniqueness is per organization
- Return only fields the caller may see (cost price: admin/manager)
- Dexie DB is named per organization

# Input validation

- Convex validators + `convex/shared/validation.ts`
- Quantities, money bounds, string lengths
- Reject unknown privilege-escalating fields
- Re-validate on the server after client checks

# File uploads

- JPG / PNG / WebP only
- Client: MIME, extension, size (≤ 2 MB), magic bytes
- Server: stored blob contentType and size
- Never trust `Content-Type` alone

# Secrets

- Never commit `.env` or keys
- Client may only receive intentional `NEXT_PUBLIC_*` values
- Store secrets in Convex env / host secret stores
- Web Push / FCM: see `docs/architecture/PUSH_NOTIFICATIONS.md` (`VAPID_*`,
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `FCM_SERVICE_ACCOUNT_JSON`)

# Portable backups

Encrypted `.novend-backup` files include PBKDF2 + AES-GCM parameters (hash,
iterations, salt, IV) in the envelope. Those values are **public** and required
to decrypt; they are not a key leak. The backup password is the secret. Files
are written as compact JSON so the envelope is a restore artifact, not a
readable showcase.

# Local-device threat model

Novend keeps a local-first operational replica in IndexedDB (Dexie) so tills can
sell offline after setup. That replica can include customers, sales, receipts,
staff shell identity, inventory, and related business data **in plaintext inside
the browser / WebView profile**.

Distinguish these protections carefully:

| Layer                              | What is protected                                                                                                                                                                                                      | What it is not                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Encryption in transit              | TLS between the client and Convex / hosted app origin                                                                                                                                                                  | Not a substitute for device custody               |
| Encrypted portable / cloud backups | `.novend-backup` archives (password + AES-GCM)                                                                                                                                                                         | Does not encrypt the live Dexie database          |
| Local operational store            | Relies on OS lock screen, browser profile isolation, app sandbox, and physical control of the till                                                                                                                     | Not field-level encryption of every IndexedDB row |
| Explicit logout                    | Deletes the bound org/user Dexie replica (including product image blobs), offline session hints, cart drafts, customer-display snapshot, and other sensitive session keys — without deleting another tenant’s database | Does not wipe the entire device                   |
| Inactivity lock                    | Configurable UI lock (default 10 minutes; Off / 5 / 10 / 15 / 30) requiring Convex Auth password reauthentication (optional native biometrics when already enabled)                                                    | Obscures the UI; does not encrypt Dexie at rest   |

**Deferred (do not invent weak custom cryptography):** field-level encryption of
sensitive Dexie fields / full live-database encryption. Document any future
design against audited libraries and key management before shipping.

**Native key material follow-up:** Capacitor exposes OS Secure Storage helpers,
but hosted-origin Capacitor Preferences / SecureStorage paths have historically
hung the WebView bridge after biometric prompts. Biometric unlock tokens
therefore remain in `localStorage` today (see `docs/architecture/HARDWARE.md`).
Electron OS keychain / Credential Manager wiring for key material is a follow-up
— do not invent a home-grown keystore.

Sensitive operational payloads should prefer IndexedDB or sessionStorage over
`localStorage` when practical (cart drafts already use sessionStorage). Keep
non-sensitive device preferences (theme, idle-lock timeout, hardware pairing)
on the device across logout.

# Web threats

| Threat               | Defense                                                                                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XSS                  | Safe rendering, CSP nonce + strict-dynamic. `proxy.ts` sets the nonce on the request (`x-nonce` + CSP) so Next.js stamps its scripts; `ThemeProvider` receives the same nonce so next-themes’ inline boot script is not blocked. |
| Clickjacking         | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`                                                                                                                                                                           |
| MIME sniffing        | `X-Content-Type-Options: nosniff`                                                                                                                                                                                                |
| HTTPS downgrade      | Production-only `Strict-Transport-Security` (`lib/security/response-headers.ts`). Do not add `preload` until every hostname is permanently HTTPS.                                                                                |
| Cross-window attacks | `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Resource-Policy: same-origin`. **COEP deferred** — `require-corp` would break Convex file URLs without matching CORP.                                                |
| CSRF                 | Auth cookie guidance; same-site                                                                                                                                                                                                  |
| Injection            | Validated inputs; Convex parameterized access                                                                                                                                                                                    |
| Privilege escalation | Server-side role + org checks                                                                                                                                                                                                    |
| IDOR                 | Org assertion after every get                                                                                                                                                                                                    |
| Mass assignment      | Explicit writable field allowlists                                                                                                                                                                                               |

Vulnerability reports: see root `SECURITY.md`. Release blockers: `docs/PRODUCTION_READINESS_CHECKLIST.md`.

# Platform telemetry privacy

First-party platform telemetry is pseudonymous and allowlist-only. Client
ingestion derives user and organization from the authenticated session and
rejects arbitrary feature/action values. Never add names, emails, IP addresses,
raw user agents, stack traces, search text, or tenant business payloads to
`platformEvents`. Detailed rows expire after 90 days; durable rollups contain
only counts and dimensions. Monitoring reads and report audit mutations require
`requirePlatformAdmin`.

# Review checklist

- [ ] Auth required
- [ ] Org isolation
- [ ] Role checks
- [ ] Validators
- [ ] No secrets in git or client bundle
- [ ] Errors do not leak internals
- [ ] Uploads constrained
- [ ] Admin-only data not returned to cashiers
