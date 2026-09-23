# Authentication

Version: 1.2.0

Related: `docs/development/14-SECURITY_GUIDE.md`, `convex/auth.ts`,
`convex/emailVerification.ts`

## Current architecture

Novend authenticates with **Convex Auth Password** and Next.js cookie sessions.
There is a single identity provider. Do not add a parallel auth system.

```text
/signup  → Convex Auth user (password)
         → OTP emailed in the background (non-blocking)
         → /onboarding (organization + owner profile)
         → dashboard / POS
/login   → password session → cached shell → POS
Staff    → created in-org by an administrator or manager (no self-signup)
Recovery → /forgot-password → hashed, single-use, 1-hour token → /reset-password
Verify   → 6-digit hashed OTP on the signed-in user (soft)
```

Password policy (server + signup/reset UI): 12 characters, upper, lower, digit.
Login does not enforce that length so legacy passwords still type.

Email is the account identifier and the recovery channel. Transactional mail
goes through Resend (`AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM`) from Convex actions.
Logos are **CID-inline PNG attachments**, not remote `/branding` URLs.

## Email verification — soft, server-owned

Verification is **not** a login, onboarding, or POS gate.

Authoritative state lives in `emailVerificationState` (`userId`, `email`,
`verifiedAt`). OTP challenges are hashed, expire in 10 minutes, are single-use,
and have attempt / resend limits. The client cannot mark an account verified.

```text
Online:  signup / login → local shell → POS
         unverified users see a dismissible banner, not a blocking screen
Offline: existing session → normal POS (no verification nag)
```

Checkout (`billing.startCheckout`) requires a verified email. Selling, inventory,
and offline use do not.

Users may change their sign-in email from Settings → Profile (or the verify
dialog). The current password is required. That updates the Convex Auth
password account id, clears verification, and sends a new OTP. It must not
create a second user.

## Google OAuth / social login — wait

**Do not add Google (or other social) login in this slice.**

Why not now:

- Cashiers and shared till devices often have no personal Google account, or
  share one. Password + PIN/biometric on device is the POS model.
- Capacitor WebView + Convex Auth cookies + OAuth redirects is a high-risk
  native integration.
- Account linking (same email, password + Google) is easy to get wrong.
- Offline-first: a cached password session can reopen the shell. OAuth always
  needs a live IdP for first sign-in on a new device.

## In-application abuse controls

Password sign-in is wrapped at the Convex Auth Password provider, so calling
`auth:signIn` directly does not bypass the application control:

- Five failed attempts for the same normalized email and installation key in a
  rolling 15-minute window lock that pair for 15 minutes.
- Attempts are reserved atomically before password verification, so a
  concurrent request burst cannot bypass the counter; success clears the
  reservation.
- Failed attempts add a 250 ms → 2 second progressive server delay.
- Failures across installation keys increase the same email's progressive
  delay. They do not trigger a hard account-only lock: someone who knows an
  email must not be able to lock the legitimate user's different installation.
- Convex Auth's default account-only hard limiter is configured out of the
  practical path because it has that denial-of-service property; the wrapper
  owns password lockouts.
- A successful password sign-in clears the email's login failures.
- Missing or malformed installation keys share a conservative `unknown`
  bucket. The key is a random client installation identifier, not a trusted
  device attestation and not an authorization input.
- Invalid credentials, unknown accounts, and locked attempts return the same
  generic sign-in error.

Recovery and verification have independent limits:

- Password-reset email: one per minute and five per hour for an existing
  account; the response is identical for existing, missing, and throttled
  accounts.
- Email OTP: one send per minute, eight sends per hour, five verification
  attempts, 10-minute expiry, and single use.
- Email change: authenticated session plus current password; five failed
  current-password checks in 15 minutes cause a 15-minute lock. The resulting
  OTP uses the email OTP limits above.

The client installation key limits ordinary browser/app abuse but is attacker
controlled and can be rotated. The per-email progressive delay raises the cost
of rotation, but it is not a substitute for network controls. Convex actions do
not expose a trustworthy source IP to this provider wrapper. Source-IP/network
throttling therefore still requires a verified edge/WAF control in front of the
real authentication endpoint.

## Release blockers and external evidence

The following are **not proven complete by this repository** and remain release
blockers / P1 follow-up:

- Direct staging/production endpoint tests and retained evidence showing the
  responsible edge/WAF source-IP limits for login, recovery, OTP, and
  email-change traffic.
- Administrator MFA or passkeys, including recovery and enrollment policy.
- Auth-session/device inventory with immediate remote session revocation.
  Deactivating an application device record is not proof that every Convex Auth
  session for that device has been invalidated.

Do not mark these controls complete from source comments or client behavior.
