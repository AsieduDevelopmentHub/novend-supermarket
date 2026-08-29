## Follow-up — Re-evaluate Email Verification for Novend

I reviewed your AUTHENTICATION.md recommendation and agree that we should NOT introduce Google OAuth now and should NOT make email verification a hard blocker before the APK.

However, I still want us to implement a professional email verification capability as a non-blocking/soft verification system.

### Goal

Keep the current:

Signup
→ Onboarding
→ Dashboard

flow intact.

Do NOT make OTP verification mandatory before onboarding or offline POS access.

Instead:

Signup
→ Account created
→ Existing onboarding
→ Dashboard
→ Email verification remains pending
→ User can verify later

### Email OTP

Implement a professional 6-digit OTP verification flow using the existing email infrastructure.

The verification screen should show:

"Verify your email"

"We sent a 6-digit verification code to"

a masked version of the actual email address.

OTP UI:

[ 4 ] [ 8 ] [ 2 ] [ 1 ] [ 7 ] [ 9 ]

NOT a single unrestricted input.

Requirements:

- One input box per digit.
- Numeric keyboard on mobile.
- Auto-advance.
- Backspace navigation.
- Full-code paste support.
- Clear focus state.
- Responsive on PWA, Capacitor, Electron and Web.
- Accessible input behavior.

### Verification actions

The verification UI must provide:

- Verify
- Resend code
- Change email
- Back/close where appropriate

Show the email that the code was sent to.

Resend must have:

- Countdown
- Rate limiting
- Expiration
- Single-use OTP
- Attempt limits

Do not expose internal errors.

### Security

OTP generation and verification must happen server-side.

Do not trust a client-side:

emailVerified = true

flag.

The backend must own the authoritative verification state.

Implement:

- Secure OTP generation
- Expiration
- Attempt limits
- Resend limits
- Single-use verification
- Rate limiting
- Verification invalidation
- Proper session handling

### Soft verification UX

After signup, show an unobtrusive verification reminder where appropriate.

Example:

"Verify your email to secure your account."

[Verify email]

Do not repeatedly interrupt the POS experience.

Do not show the verification screen on every app startup.

Do not make offline operation depend on email verification.

### When verification SHOULD matter

Use verification as a security/account-trust signal for future capabilities where appropriate, such as:

- Password recovery confidence
- Sensitive account changes
- Billing/account ownership operations
- Future MFA enrollment
- Organization ownership transfer
- Other high-risk account operations

Do not arbitrarily block normal POS usage.

### Change email

Allow an unverified user to change their email.

When changed:

- Update the pending email appropriately.
- Invalidate the previous OTP.
- Send a new OTP.
- Do not accidentally create a second account.
- Preserve the current signup/account session.

### Offline architecture

Email verification itself requires connectivity.

Once the account/session already exists:

Online:
Signup / verification / authentication
        ↓
Authenticated session
        ↓
Local session + IndexedDB
        ↓
Offline POS

Offline:
Existing authenticated session
        ↓
Normal offline-first POS

Do NOT introduce a global:

"email must be verified before app can work"

gate.

### Existing authentication architecture

Before implementation, inspect:

- AUTHENTICATION.md
- Existing Convex Auth implementation
- Existing password reset flow
- Existing Resend/email infrastructure
- User schema
- Signup flow
- Session handling
- Onboarding routing
- Offline session persistence

Reuse the existing infrastructure.

Do NOT create a second authentication system.

### Important

Your previous recommendation said:

"Do not add email verification before the APK."

I agree with not making it a blocking requirement.

However, the requirement now is to build the underlying verification capability in a way that is compatible with the existing authentication architecture and can be enabled/enforced progressively later.

Do not implement Google OAuth.

Do not change the existing onboarding flow.

Do not break the existing password reset flow.

### Testing

Add tests for:

- OTP generation
- OTP expiration
- Correct OTP
- Incorrect OTP
- OTP reuse
- Resend
- Rate limiting
- Change email
- Already verified user
- Verification state persistence
- Session handling
- Offline authenticated session
- Attempted client-side verification bypass

Keep all existing tests passing.

Create a meaningful Git commit for the email-verification feature.

Before implementation, briefly explain where the verification state and OTP flow will integrate into the current authentication architecture.