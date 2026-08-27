## Capacitor — Native Feature Root-Cause Fix

The following Capacitor mobile bugs are still occurring. Do a proper root-cause investigation and fix the native integrations, not just the error messages.

### 1. Capture Image — Camera

**Current behavior:**

* Tapping **Capture Image** shows a toast saying camera access is turned off.
* The camera dialog/native camera does not open at all.

Audit the actual Capacitor Camera implementation:

* Camera plugin/configuration
* Android camera permission
* Runtime permission handling
* Camera availability detection
* Native bridge
* Camera lifecycle
* Permission state caching
* Duplicate camera initialization
* Error handling

Determine why the app incorrectly reports the camera as disabled and why the native camera is never launched.

Expected:

**Capture Image → permission check/request → native camera opens → capture → image returned → preview/local persistence**

Do not hardcode the camera as available or hide the error. Fix the actual native integration.

---

### 2. Receipt — Share & Save as PDF

Both **Share Receipt** and **Save as PDF** currently fail with:

> Unable to {action}, please try again

Trace the complete implementation and identify the actual failure.

Check:

* Receipt generation
* Blob/file creation
* Capacitor filesystem
* File URI/path handling
* Android storage restrictions
* Share plugin/native intent
* MIME types
* WebView/native bridge
* Permissions
* Error handling

Expected:

**Receipt → generate file → persist correctly → native Share/Save action**

It must work on Capacitor Android without requiring internet.

---

### 3. Receipt — Print

Print currently displays an **"Opening..."** state/dialog, but the actual print dialog never appears.

Audit the print implementation and determine why the native/system print flow is not being launched.

Check:

* Current print implementation
* iframe/window printing
* Capacitor WebView limitations
* Android print APIs/intents
* PDF/receipt generation
* Native bridge
* Print plugin/configuration if one is already used

Do not leave the UI permanently saying "Opening".

If the existing implementation is incompatible with Capacitor, implement the appropriate native-compatible approach while preserving Web/Electron printing.

---

### 4. Notifications

Notification functionality still reports errors and must be audited together with the native permission system.

Check:

* Capacitor Local Notifications plugin
* Android notification permission
* `POST_NOTIFICATIONS`
* Runtime permission request
* Permission state detection
* Android API level behavior
* Plugin initialization
* App lifecycle/resume
* Native bridge

Correctly distinguish:

* Not requested
* Granted
* Denied
* Permanently denied
* Unsupported
* Actual error

Do not report "unavailable" when the real problem is permission/configuration/plugin failure.

---

### 5. Settings → Security still freezes

The Security page still freezes, particularly when checking native capabilities/permissions.

Trace every operation executed when Security opens:

* Biometrics
* Notifications
* Camera/permissions if involved
* Convex/network calls
* IndexedDB
* React effects
* Capacitor plugins
* Async promises
* Event listeners

Identify the exact operation causing the freeze.

No native capability check should be able to block or freeze the entire Security UI.

Every async operation must have:

**loading → success / unavailable / denied / error**

and must always resolve or timeout safely.

---

## Important

Do not treat these as five unrelated UI bugs.

Investigate whether they share a common root cause in the **Capacitor native bridge, plugin initialization, Android permissions, WebView lifecycle, or recent version regression**.

Compare the current implementation with the previously working release where these native features worked.

Before making major changes, provide a concise root-cause report, then implement and test the fixes.

### Acceptance

* Camera actually opens on Capture Image.
* Correct camera permission state is detected.
* No duplicate camera invocation/toasts.
* Share Receipt works.
* Save as PDF works.
* Print dialog actually opens.
* Notifications correctly detect/request permission.
* Security never freezes, including offline.
* All native failures produce useful user-friendly errors.
* Web and Electron functionality remains intact.
* Camera, receipt, and notification functionality works without internet where applicable.
