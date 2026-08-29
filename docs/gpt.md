
## Novend — Production Email OTP Verification Flow

Implement a professional email verification flow for new account registration.

### 1. Signup flow

Change the new-account flow to:

Signup
→ Create account
→ Send verification OTP
→ Email Verification
→ Existing New Business/Onboarding
→ Dashboard

Do not replace or redesign the existing onboarding. Verification should simply become the required step before entering it.

---

### 2. OTP

Use a fixed-length OTP: choose either 6 or 8 digits based on the existing auth/email architecture, but keep the length consistent everywhere.

The verification UI must use **separate OTP boxes**, not one unrestricted text input.

Example for 6 digits:

[ 4 ][ 8 ][ 2 ][ 1 ][ 7 ][ 9 ]

Requirements:

- One box per digit.
- Numeric input only.
- Automatically advance after entering a digit.
- Backspace moves to the previous box when appropriate.
- Pasting a complete OTP should populate all boxes.
- Support keyboard navigation.
- Clear visual focus state.
- Invalid OTP should clearly indicate the error without destroying the user's input unnecessarily.
- Proper mobile keyboard/input behavior.
- Accessible labels and focus handling.
- Responsive on Web, PWA, Electron and Capacitor.

Do not create an "infinite" input or rely on a single uncontrolled text field.

---

### 3. Verification screen

Create a professional verification screen containing:

**Verify your email**

We've sent a verification code to:

**a***@example.com**

Use the actual user's email with appropriate masking.

Actions:

- OTP input
- Verify button
- Resend code
- Change email
- Back to Sign Up

The user must always know which email the OTP was sent to.

---

### 4. Change email

If the user selected **Change email**:

- Return to the appropriate signup/email step.
- Allow the user to enter a different email.
- Invalidate the previous verification attempt where appropriate.
- Send a new OTP to the new address.
- Continue verification using the new address.

Do not accidentally create multiple accounts for the same signup attempt.

---

### 5. Resend OTP

Implement a controlled resend mechanism.

Requirements:

- Countdown before another resend is allowed.
- Prevent OTP spam.
- Generate a new OTP when appropriate.
- Invalidate the previous OTP when the security model requires it.
- Clearly show when the user can request another code.
- Provide useful user-friendly error states.

Example:

`Resend code in 42s`

then:

`Resend code`

Do not expose backend/rate-limit implementation details.

---

### 6. OTP security

Do not store or compare OTPs insecurely on the client.

The backend should handle:

- OTP generation
- Secure storage/hashing where appropriate
- Expiration
- Attempt limits
- Resend limits
- Verification
- Invalidation after successful verification
- Abuse/rate limiting

OTP should be short-lived and single-use.

Do not trust a client-provided "verified" flag.

---

### 7. Email state

The backend should have an authoritative verification state.

For example:

`emailVerified = false`

until the OTP is successfully validated.

After successful verification:

`emailVerified = true`

The client must not be able to bypass verification simply by navigating directly to the onboarding route.

---

### 8. Offline behavior

Email verification requires network connectivity.

However, this must NOT damage Novend's offline-first POS architecture.

The restriction applies only to the **new-account verification process**.

After the account has been successfully verified, authenticated, and initialized:

`Verification → Authentication → Local session → Offline-first application`

Existing authenticated users must continue to use their locally available POS functionality offline.

Do not introduce a global "must be online" gate into the application.

---

### 9. Successful verification

After successful OTP verification:

1. Mark the email verified server-side.
2. Preserve the authenticated signup session.
3. Navigate to the **existing new-business/onboarding flow**.
4. Do not send the user to Dashboard prematurely.
5. Existing onboarding should continue normally.
6. Once onboarding is completed, continue to Dashboard as it currently does.

---

### 10. UX states

Handle professionally:

- Sending OTP
- OTP sent
- Verifying
- Invalid OTP
- Expired OTP
- Too many attempts
- Resend cooldown
- Email delivery failure
- Network failure
- Already verified
- Session expired
- Changed email
- Successful verification

Do not display raw backend errors such as `ERR_*`, Convex errors, or internal exceptions.

---

### 11. Routing/security

Prevent users from bypassing verification by manually navigating to:

`/onboarding`

or other protected signup/onboarding routes.

The routing logic should understand:


New account
   ↓
Email unverified
   → /verify-email

Email verified
   → /onboarding

Existing authenticated account
   → /dashboard
````

Ensure logout/login on the same device cannot restore another user's verification/onboarding route.

---

### 12. Audit before implementation

First inspect the existing:

* Signup flow
* Authentication/session model
* User schema
* Email infrastructure
* Existing onboarding routes
* Routing guards
* Error handling
* Convex mutations/queries
* Existing email templates

Do not create duplicate authentication or email systems.

Reuse the existing infrastructure where possible.

Before large changes, provide a concise root-cause/design report explaining where email verification belongs in the current architecture.

Then implement incrementally and add tests for:

* Account creation
* OTP generation
* OTP expiration
* Correct OTP
* Incorrect OTP
* OTP reuse
* Resend
* Rate limiting
* Change email
* Verification bypass attempts
* Already verified accounts
* Session expiration
* Routing after verification

Create a meaningful Git commit after the major authentication/email-verification implementation.

```

### One design decision I'd make

I'd use **6 digits**, rather than 8.

For a POS/SaaS onboarding flow:

**6 digits = `482179`**

is easier to read, type, remember, and enter on a phone while still giving you **1 million possible combinations**. The security should come primarily from **short expiry + attempt limits + rate limiting + single-use**, rather than making the user type an unnecessarily long code.

And visually, the separate boxes will make a significant difference on Capacitor:

**Verify your email**

> We've sent a 6-digit code to  
> **a••••@gmail.com**

`[ 4 ] [ 8 ] [ 2 ] [ 1 ] [ 7 ] [ 9 ]`

**[ Verify email ]**

`Resend code in 32s`

`Change email · Back to sign up`

Then, after verification:

**→ your existing business onboarding**, not another new onboarding experience.
```
