## Capacitor — Deep Root-Cause Fix: Scanner, Biometrics & Notifications

There are still 3 critical Capacitor issues. Do NOT apply a superficial fix or just change the error message. Inspect the existing implementation, trace the actual failure path, identify the root cause, then fix the underlying architecture.

### 1. Barcode scanner — make ZXing the default

The current Test Scanner frequently fails with:

"Unable to start scanner"

and logs an error similar to:

"play request was interrupted by a new load request: https://google..."

This happens especially when offline.

However, when the user presses **Try Again**, the existing ZXing fallback starts and works correctly.

Investigate why the current/default scanner attempts to load or initialize the failing scanner first, particularly:

- camera/WebView initialization
- BarcodeDetector/native scanner selection
- external Google/HTTPS resources
- scanner startup race conditions
- camera stream lifecycle
- offline navigation/loading
- multiple scanner initialization attempts

### Required change

Make the existing **ZXing implementation the primary/default camera barcode scanner** for Capacitor.

Expected flow:

Camera permission
→ Camera stream
→ ZXing decoder
→ Barcode detected
→ Return barcode

Do NOT initialize the currently failing scanner first.

Do NOT depend on Google/HTTPS resources for scanner startup.

Keep hardware barcode scanning as the primary input when configured, with ZXing as the camera fallback.

Also ensure:

- offline scanning works
- scanner starts without pressing Try Again
- camera is cleaned up correctly
- reopening scanner works
- leaving/re-entering scanner does not create duplicate streams
- no scanner startup race conditions

---

### 2. Security → Biometrics still not detecting correctly

Settings → Security still cannot correctly determine biometric availability.

Investigate the actual Capacitor/native biometric implementation:

- plugin/API currently being used
- Android implementation
- plugin initialization
- device capability detection
- permission/configuration
- promise resolution/rejection
- lifecycle/resume handling
- WebView/native bridge
- timeout/fallback behavior

Do not leave the UI stuck on "Checking biometrics".

Every check must resolve to a real state:

Available / Unavailable / Unsupported / Error.

Determine why the current implementation reports incorrectly and fix the native integration rather than masking the result in the UI.

---

### 3. Notifications still show "Notification unavailable on this device"

Do not assume the device is actually unsupported.

Trace the exact source of this state.

Check:

- Capacitor notification plugin
- Android notification permission
- `POST_NOTIFICATIONS`
- Android API level
- runtime permission state
- plugin initialization
- permission API response
- app resume state
- native configuration

Determine whether:

1. Permission is missing,
2. Permission API is failing,
3. Plugin is incorrectly initialized,
4. Android configuration is incomplete, or
5. The device is genuinely unsupported.

Then fix the underlying cause.

The UI must distinguish:

Granted
Denied
Not requested
Permanently denied
Unavailable/unsupported
Actual error

Do not simply force the UI to say "available".

---

## Required process

Before changing the implementation, inspect the existing code and provide a concise root-cause report for all 3 issues.

Then implement the fixes.

Do not just patch the symptoms.

### Acceptance criteria

- ZXing starts directly without Try Again.
- No Google/HTTPS dependency is required for camera scanning.
- Scanner works offline.
- Scanner can repeatedly open/close without breaking.
- Hardware scanner behavior remains intact.
- Biometrics correctly detects the actual device capability.
- No infinite biometric loading state.
- Notifications correctly detect/request Android permission.
- "Notification unavailable" is only shown when genuinely unsupported.
- Native failures cannot freeze Settings.
- No regression to Web or Electron.