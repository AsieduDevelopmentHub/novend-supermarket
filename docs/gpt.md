## Novend — P0 Production Fixes + Mobile Startup/Offline UX

Start with ALL currently identified P0 issues. Do not choose only one.

### P0 SECURITY / FUNCTIONAL FIXES

1. Password reset
- Implement a complete owner password-reset/recovery flow.
- Add /forgot-password and the required reset flow.
- Follow the existing authentication architecture.
- Do not create a parallel auth system.
- Ensure reset tokens are secure, expire, and cannot be reused.

2. Two-organization IDOR tests
- Add adversarial tests using at least two organizations.
- Verify every patched tenant-sensitive write path cannot access or mutate another organization.
- Cover products, profile/staff operations and the remaining sensitive Convex mutations.
- Make these regression tests part of CI.

3. Android Camera
- Deeply debug the Capacitor native camera integration.
- Fix the "camera access is turned off" false error.
- Ensure runtime permission handling works.
- Ensure the native camera actually launches.
- Compare against the last known working implementation/release.
- Do not solve this with a retry-only UI workaround.

4. Android Receipt Share / Save PDF / Print
- Fix Share Receipt.
- Fix Save as PDF.
- Fix Print.
- Trace the native Capacitor bridge, filesystem, URI/MIME handling, Android intents/plugins and receipt generation.
- Print must actually launch the system print dialog.
- Do not leave the UI stuck on "Opening...".
- Errors must identify the real failure without exposing internal exceptions.

5. Storage upload tenant binding
- Ensure generated upload URLs/storage operations are organization-bound.
- A storage ID from organization A must not be attachable to organization B.
- Add regression tests.

6. updateExpense branch authorization
- Verify the new branchId belongs to the authenticated user's organization before updating an expense.
- Add a regression test for cross-organization branch injection.

7. Password policy
- Align client validation with the server's actual password policy.
- Do not allow the UI to advertise weaker requirements than the backend.
- Show Users Strenght of their password to make it user friendly so users can know their passwords are accepted rather than later verification checks that showcase a toast.

---

# MOBILE STARTUP / LOADING UX

There is currently too much sequential loading during Capacitor startup.

Current experience is approximately:

Open app
→ "Preparing..."
→ "Opening Novend..."
→ startup animation
→ authentication/session initialization
→ dashboard loading
→ finally dashboard

This feels slow and artificial even when the device is online.

Audit the entire Capacitor boot sequence and identify every loading/splash state.

### Goal

Reduce unnecessary sequential loading.

The desired experience should be closer to:

Open app
→ lightweight native/app startup
→ immediately restore local shell/session
→ render application/dashboard from local state
→ refresh/sync data silently in background

Do NOT remove legitimate initialization requirements. Instead, eliminate duplicated loading gates and unnecessary sequential waits.

Investigate:

- Capacitor app initialization
- WebView startup
- authentication restoration
- IndexedDB initialization
- Dexie initialization
- Convex initialization
- service worker
- cached app shell
- route restoration
- dashboard data hydration
- splash screen
- startup animation
- "Preparing..." state
- "Opening Novend..." state
- duplicate loading screens

Determine which operations actually block application rendering and which can happen asynchronously.

### Important

Do not simply make the loading text disappear.

Fix the architecture so the application becomes usable sooner.

If local session/data exists:

LOCAL STATE
→ render immediately
→ background synchronization

rather than:

INITIALIZE EVERYTHING
→ wait
→ fetch everything
→ render application

Keep a lightweight fallback/loading state only when absolutely necessary.

---

# OFFLINE PUBLIC ASSETS

Public assets such as:

- Novend logo
- branding images
- icons
- application illustrations
- other static public assets

sometimes do not render offline.

This is particularly noticeable when the application has already been opened but the device later loses connectivity.

Audit how these assets are loaded and cached.

Determine whether they are:

- remote URLs
- Vercel-hosted assets
- Next.js static assets
- service-worker cached assets
- dynamically fetched resources

The application shell and required branding assets should be available offline after the application has been properly initialized at least once.

### Requirements

- Cache required static application assets.
- Do not make the application request a remote public image every time it renders.
- Avoid breaking cache invalidation when assets are updated.
- Do not cache user-specific/private assets as public assets.
- Ensure Capacitor and PWA use the appropriate caching mechanism.
- Verify that the logo and core branding remain visible when the device transitions from online → offline.

Do not blindly cache every image. Identify the minimum required offline application shell/assets.

---

# OFFLINE-FIRST STARTUP

The startup changes must preserve Novend's offline-first architecture.

After the application has been initialized once:

Online:
  Local shell/session/data
        ↓
  Immediate render
        ↓
  Background sync

Offline:
  Local shell/session/data
        ↓
  Immediate render
        ↓
  Offline state / queued sync

There should NOT be a requirement to reconnect merely to render the application shell.

---

# TEST MATRIX

Test at minimum:

### Capacitor
- Fresh install online
- Login online
- Close/reopen online
- Close/reopen offline
- Online → offline after login
- Offline → online
- Camera permission denied
- Camera permission granted
- Share receipt
- Save PDF
- Print receipt

### PWA
- First load online
- Reload online
- Online → offline
- Reload offline
- Logo/static assets offline
- Dashboard offline

### Security
- Organization A attempting organization B access
- Cross-org storage attachment
- Cross-org branch assignment
- Password reset
- Expired reset token
- Reused reset token

### Startup performance

Measure the actual sequence and identify unnecessary blocking operations.

The goal is not merely a faster animation. The goal is a faster **time-to-usable-application**.

---

# IMPLEMENTATION RULE

Before changing code, provide a concise root-cause report covering:

1. Password recovery gap.
2. Remaining tenancy/IDOR risks.
3. Android camera failure.
4. Android receipt failures.
5. Storage binding vulnerability.
6. updateExpense branch authorization.
7. Password policy mismatch.
8. Capacitor startup/loading chain.
9. Offline public/static asset loading.
10. Any additional P0/P1 issues discovered while tracing these paths.

Then implement the fixes.

Use the existing architecture wherever possible. Do not create duplicate services, authentication systems, caching systems, or native integrations.

Create a meaningful Git commit after each major feature/fix/refactor/chore.

After implementation, run the existing test suite and add the missing regression tests. The existing 205 passing tests must remain passing, except where a test correctly reflects intentionally changed behavior.