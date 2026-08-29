# Authentication

Version: 1.1.0

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

MFA / passkeys for organization owners remain a later P1, after recovery and
verification mail is reliable in production.
