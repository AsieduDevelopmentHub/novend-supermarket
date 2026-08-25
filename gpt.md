## Novend — Deep Production Regression Audit & Fix

We have multiple Web/PWA, Electron, Capacitor Android, caching, routing, native-plugin, and UI issues. Do NOT apply superficial patches. Perform a full root-cause investigation, trace the regressions through the existing code/history, then implement and verify the fixes.

### 1. Intermittent "site unavailable / refresh" errors

Internet connectivity is sometimes strong, but Web/PWA shows the native browser error:

"Novend ... app refresh / site unavailable"

Capacitor Android can also show:

"Website not available"

while the device is actually online.

Investigate the complete chain:

- WebView/network configuration
- Capacitor server/origin configuration
- PWA service worker/cache
- stale app shell
- DNS/origin failures
- fetch failures
- navigation requests
- offline detection logic
- retry/reconnect handling
- WebView lifecycle
- cached routes/assets
- API/Convex availability
- error boundaries

Determine whether the application is incorrectly treating a temporary resource/API failure as a complete website failure.

The app should gracefully recover from temporary connectivity/resource failures without displaying the native "website unavailable" screen.

---

### 2. Super Admin pages are extremely slow

Many Platform/Super Admin pages take too long to load.

Detailed screens often show:

"Fast load / no data cached for this insight"

even though the information should already be available locally.

Audit the Platform/Super Admin data architecture and identify:

- unnecessary Convex waits
- sequential queries
- full-table scans
- duplicate queries
- missing IndexedDB caching
- missing repository usage
- repeated data fetching
- blocking analytics calculations

Where appropriate:

Local cache → immediate render → background refresh.

Do not make the UI wait for every analytics/detail query before rendering.

Cache the actual data required by the detailed screens, not just a "no data cached" placeholder.

---

### 3. Simplify the mobile/PWA cart

Replace the current cart presentation with a simple mobile-friendly cart CTA:

[ 🛒 ] with a small count badge.

Requirements:

- Cart icon.
- Badge showing item count.
- Default count = `0`.
- Compact and unobtrusive.
- Clicking it opens the checkout/cart interface on PWA/mobile.
- Preserve existing cart functionality.

---

### 4. Mobile checkout cannot fully slide out

The checkout/cart panel on mobile sometimes does not fully open/expand and requires manually dragging it.

Fix the underlying sheet/drawer implementation.

It should:

- Open fully from the CTA.
- Respect viewport height.
- Respect safe-area insets.
- Not be constrained by an incorrect parent overflow.
- Not require manual dragging to become usable.
- Work consistently on PWA and Capacitor.

---

### 5. Mobile modal close buttons invisible

Many mobile modals have invisible or barely visible close icons.

Example:

- Add Product modal.

Audit the shared modal/dialog component and fix the common source.

Ensure:

- Close button is always visible.
- Sufficient contrast.
- Proper size/touch target.
- Correct z-index.
- Not hidden behind content.
- Works in light/dark mode.
- Works on PWA and Capacitor.

Do not manually patch every modal unless the modal genuinely has a unique implementation.

---

### 6. PWA/mobile toast positioning

Current toast notifications appear too close to the top of the screen.

Move the toast system to a more appropriate mobile-safe position while preserving the existing desktop placement where appropriate.

Check:

- Safe-area inset.
- Header overlap.
- Modal overlap.
- Bottom navigation overlap.
- Multiple toast stacking.
- Dismiss/close behavior.

Do not let important UI/content become hidden behind toasts.

---

### 7. Mobile version/update detection is incorrect

The mobile application can indicate that the latest version is installed even when the latest APK/version has not actually been installed.

Audit the complete update/version mechanism:

- native app version
- package version
- remote release version
- cached version
- update metadata
- comparison logic
- APK installation state

Do not trust stale cached metadata.

The displayed status must represent the **actual installed Capacitor version** compared with the latest available release.

---

### 8. CRITICAL REGRESSION — Biometrics & Notifications

This is one of the biggest issues.

In release **v0.3.0**, biometrics and notifications were working correctly.

From **v0.3.1 onward**, they started producing incorrect/bogus errors.

Do a regression investigation.

Compare:

`v0.3.0 → v0.3.1 → current`

Identify exactly what changed in:

- Capacitor plugins
- Android configuration
- AndroidManifest
- permissions
- native initialization
- biometric implementation
- notification implementation
- WebView bridge
- dependency versions
- build configuration
- app lifecycle
- permission handling

Do NOT rewrite the features blindly.

Find the regression and restore the working behavior while preserving legitimate newer changes.

---

### 9. Security page still freezes offline

Settings → Security still freezes when offline.

This must be treated as an architectural bug.

The Security screen must render without waiting for:

- Convex
- network
- notification API
- biometric API
- remote data

Native checks must fail gracefully and asynchronously.

No infinite promise/loading state should be able to block the page.

Trace the exact operation causing the freeze.

---

### 10. Legal & Support pages inside the app

Legal and Support pages should render properly inside the Novend application.

When accessed inside:

- PWA
- Capacitor
- Electron

they should behave as application pages.

Do NOT show unnecessary:

"Go back to Novend landing page"

links inside the application version if they are not appropriate.

Audit how these pages determine whether they are running inside the marketing site versus the actual application.

---

### 11. Share & Print Receipt regression

Receipt sharing and printing stopped working from **v0.3.1**.

Investigate the regression between:

`v0.3.0 → v0.3.1 → current`

Check:

- native share implementation
- print implementation
- WebView restrictions
- Capacitor plugins
- receipt generation
- PDF/blob generation
- file permissions
- URI handling
- Android intent handling
- Electron/Web differences

Restore the functionality without breaking the existing receipt system.

---

### 12. Login routing

Every successful login should start at the **Dashboard**.

Currently the application can restore the route/page where a previous user left the application.

Fix this.

After successful authentication:

`Login → Dashboard`

Do NOT restore the previous user's route.

This is especially important when:

`Super Admin logout → Client login`

The new user must never be sent back to `/platform` or another route belonging to the previous session.

Clear/invalidate previous route state during logout and determine the landing page from the newly authenticated session.

---

## Required investigation

Before making large changes, provide a concise root-cause report covering:

1. Intermittent WebView/PWA "website unavailable".
2. Super Admin performance/caching.
3. Checkout/cart behavior.
4. Modal/toast issues.
5. Incorrect mobile version detection.
6. v0.3.0 → v0.3.1 biometric regression.
7. v0.3.0 → v0.3.1 notification regression.
8. Security offline freeze.
9. Share/print regression.
10. Authentication route persistence.

Use git history/releases where available. Specifically compare the working `v0.3.0` implementation against `v0.3.1` and current code for biometrics, notifications, sharing, and printing.

Do not assume the cause.

Trace the actual code path.

---

## Final acceptance criteria

- Web/PWA does not incorrectly display a native "website unavailable" screen during temporary connectivity/resource failures.
- Capacitor recovers gracefully from temporary network failures.
- Super Admin pages render cached/local data immediately where supported.
- No unnecessary Convex/network blocking on page render.
- Mobile cart is a simple icon + count badge.
- Checkout opens fully without manual dragging.
- Mobile modal close buttons are visible and usable.
- Toasts do not obstruct the mobile UI.
- Installed app version is detected from the actual native app version.
- Biometrics work as they did in v0.3.0.
- Notifications work as they did in v0.3.0.
- Security does not freeze offline.
- Legal/Support render correctly inside the application.
- Share Receipt works.
- Print Receipt works.
- Every successful login lands on Dashboard.
- Previous user's route/session state cannot leak into the next login.
- Web, PWA, Electron, and Capacitor behavior remains consistent where functionality is shared.

Most importantly: **fix the root causes and regressions, not the symptoms. Do not mark an issue resolved merely because its error message disappeared.**