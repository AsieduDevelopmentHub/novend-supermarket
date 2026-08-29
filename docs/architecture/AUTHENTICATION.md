# Authentication

Version: 1.0.0

Related: `docs/development/14-SECURITY_GUIDE.md`, `convex/auth.ts`

## Current architecture

Novend authenticates with **Convex Auth Password** and Next.js cookie sessions.
There is a single identity provider. Do not add a parallel auth system.

```text
/signup  → Convex Auth user (password)
         → /onboarding (organization + owner profile)
/login   → password session → cached shell → POS
Staff    → created in-org by an administrator or manager (no self-signup)
Recovery → /forgot-password → hashed, single-use, 1-hour token → /reset-password
```

Password policy (server + signup/reset UI): 12 characters, upper, lower, digit.
Login does not enforce that length so legacy passwords still type.

Email is the account identifier and the recovery channel. Transactional mail
goes through Resend (`AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM`) from Convex actions.

## Email verification — wait

**Do not gate signup, onboarding, or selling on a verify-email click.**

Why not now:

- The owner is often setting up a shop on a phone or till. Blocking the first
  sale on inbox access fights the POS workflow.
- Password reset already proves mailbox control at the moment it matters.
- Convex Auth `verify` (OTP) would be a second identity path beside the custom
  reset tokens. Keep one recovery design.
- Unverified typos still hurt recovery, but a blocking gate does not fix
  disposable inboxes and adds drop-off.

Do later, when abuse or billing risk shows up:

1. **Soft verify** after the org exists: banner + security email, no lockout.
2. **Hard verify before paid checkout** if Paystack disputes or fake trials
   become material.
3. Staff **invite links** instead of admin-set passwords.

## Google OAuth / social login — wait

**Do not add Google (or other social) login in this slice.**

Why not now:

- Cashiers and shared till devices often have no personal Google account, or
  share one. Password + PIN/biometric on device is the POS model.
- Capacitor WebView + Convex Auth cookies + OAuth redirects is a high-risk
  native integration. Camera/print just stopped using plugin-availability
  gates for the same class of failure.
- Account linking (same email, password + Google) is easy to get wrong and
  creates tenant-confused identities.
- Offline-first: a cached password session can reopen the shell. OAuth always
  needs a live IdP for first sign-in on a new device.
- Google identity is not organization membership. Onboarding, roles, and
  licenses stay ours either way.

Revisit after:

- Reset email delivery is proven in production
- Native Android auth redirects are designed (Custom Tabs, not in-WebView)
- Explicit owner-only “Continue with Google” plus linking rules are specified

MFA / passkeys for organization owners remain a later P1, after recovery mail
is reliable.
