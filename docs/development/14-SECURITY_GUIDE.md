# Novend POS

## Security Guide

Version: 1.0.1

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
- Login is rate-limited by email (`loginAttempts`): 5 failures / 15 minutes →
  15-minute lockout
- Password reset is hashed, single-use, and expires in one hour
  (`/forgot-password`). Do not add a second recovery system.
- Email verification is a **soft**, server-owned 6-digit OTP. It does not block
  signup, onboarding, or POS. Checkout requires a verified email. See
  AUTHENTICATION.md. Social login is **not** in this slice.
- `proxy.ts` enforces auth on app routes; Convex remains the API source of truth
- First session on a device requires network; later offline refresh uses a
  cached shell profile

# Authorization

Every Convex query/mutation/action that touches business data must:

1. Authenticate
2. Resolve organization from the session profile
3. Authorize role / branch
4. Validate input
5. Enforce business rules
6. After `db.get`, assert `organizationId`

Hiding a button is not authorization.

| Role          | Capabilities                                                      |
| ------------- | ----------------------------------------------------------------- |
| Cashier       | Sales, hold/resume, receipts, own orders/returns, customer lookup |
| Manager       | Branch ops, catalog, inventory, cashiers in branch                |
| Administrator | Organization-wide, including users and settings                   |
| Owner         | Administrator + cannot be deactivated in this slice               |

A user cannot set their own account inactive. A signed-in (online) account
cannot be set inactive until they sign out. Convex enforces both; hiding the
control is not authorization.

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

# Portable backups

Encrypted `.novend-backup` files include PBKDF2 + AES-GCM parameters (hash,
iterations, salt, IV) in the envelope. Those values are **public** and required
to decrypt; they are not a key leak. The backup password is the secret. Files
are written as compact JSON so the envelope is a restore artifact, not a
readable showcase.

# Web threats

| Threat               | Defense                                                                                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XSS                  | Safe rendering, CSP nonce + strict-dynamic. `proxy.ts` sets the nonce on the request (`x-nonce` + CSP) so Next.js stamps its scripts; `ThemeProvider` receives the same nonce so next-themes’ inline boot script is not blocked. |
| CSRF                 | Auth cookie guidance; same-site                                                                                                                                                                                                  |
| Injection            | Validated inputs; Convex parameterized access                                                                                                                                                                                    |
| Privilege escalation | Server-side role + org checks                                                                                                                                                                                                    |
| IDOR                 | Org assertion after every get                                                                                                                                                                                                    |
| Mass assignment      | Explicit writable field allowlists                                                                                                                                                                                               |

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
