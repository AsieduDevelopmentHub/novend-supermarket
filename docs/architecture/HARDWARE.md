# Hardware architecture

Version: 1.5.0

## Purpose

Manage POS peripherals through a shared hardware abstraction and platform
adapters. Desktop printers / HID scanners and Capacitor camera / barcode /
share / files / Bluetooth print / biometrics are live.

## Layers

```text
UI / Settings / Sales
        ↓
services/print · services/hardware · services/receipts
        ↓
@novend/hardware                     (sole platform entry)
        ├── Web adapter
        ├── Electron adapter → window.novendDesktop
        └── Capacitor adapter → Camera, in-app ZXing barcode, BLE print,
                                Filesystem, Share, Secure Storage, App deep links
                                + window.NovendNative (Downloads, share,
                                notification state, biometrics)
        ↓
apps/desktop IPC → hardware/registry   (Electron only)
apps/mobile      → native plugins      (Capacitor)
```

## Package

`packages/hardware` (`@novend/hardware`) exposes:

- Platform helpers: `getPlatform`, `isWeb`, `isElectron`, `isCapacitor`, …
- Facades: `Hardware.camera`, `Hardware.barcode`, `Hardware.printer`,
  `Hardware.bluetoothPrinter`, `Hardware.biometrics`, `Hardware.secureStorage`,
  `Hardware.notifications`, `Hardware.app`, …
- Permission copy helpers (request only when a feature needs access)
- Bounded waits: `withTimeout` / `NATIVE_*_TIMEOUT_MS` so Settings and scanners
  fail soft instead of hanging the WebView on a stuck Capacitor plugin
  (`NATIVE_AVAILABILITY_TIMEOUT_MS` for biometrics / notification checks)
- Capacitor Camera / BLE adapters load **lazily** — importing
  `@novend/hardware` for biometrics must not evaluate Camera or BLE
- Result types shared across adapters

UI components must not call Electron preload or Capacitor plugins directly.

## Capacitor (Phase 4)

| Feature                 | Behavior                                                                                                                                                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera / Take Photo     | **In-dialog `getUserMedia`** on HTTPS / localhost. Native still is a **manual** button only when live preview is missing (Cap HTTP). Never auto-launch the system camera on open.                                                                                                  |
| Save receipt / export   | `downloadBlob` writes Android **Downloads** via `window.NovendNative` (WebView JavascriptInterface). Do not call Capacitor Filesystem / NovendPrint after the hosted origin loads.                                                                                                 |
| Share receipt           | Capacitor: Android share sheet via `window.NovendNative.finishShare` (PDF + FileProvider). Web/Electron: Web Share API when it can take a file; otherwise Downloads.                                                                                                               |
| Print receipt           | Same `receiptPrintMode` on web, Electron, and Capacitor. Cap: Automatic/Manual print one ESC/POS copy over Classic SPP via `NovendNative` (Android) or BLE Cap plugin (may time out on hosted origin). Share/Save PDF are recovery paths — never counted as thermal print success. |
| Bluetooth thermal print | Settings → Hardware: prefer **Android paired (Classic)**. Pair in system Bluetooth first, then Discover. Nearby BLE still uses Cap BLE and is secondary on hosted Cap.                                                                                                             |
| Local image durability  | Also written under Capacitor `Directory.Data` (`product-images/`)                                                                                                                                                                                                                  |
| Barcode (camera)        | In-dialog getUserMedia → bundled **ZXing**. Photograph-barcode is a manual fallback only.                                                                                                                                                                                          |
| Barcode (HID)           | Terminal wedge config + `useBarcodeScanner` (desktop primary)                                                                                                                                                                                                                      |
| Biometrics              | Status via `BiometricManager.BIOMETRIC_WEAK` (includes Class 3). Prompt prefers Class 3 + device PIN; Class 2-only phones use weak + Cancel. Unlock token only (not the account password).                                                                                         |
| Unlock token storage    | `localStorage` (primary). Best-effort Cap SecureStorage with short timeout — Cap Preferences hang after hosted origin.                                                                                                                                                             |
| Notifications           | Remote: Web Push (VAPID), Capacitor FCM token via `@capacitor/push-notifications`, Electron foreground via outbox + desktop `Notification`. Cap also keeps LocalNotifications for on-device schedules. Topic prefs: `localStorage` + Convex `pushDevices`. |

| Deep links              | `novend://sale/…`, `novend://product/…` via `Hardware.app`                                                                                                                                                                                                                         |
| Soft updates            | Optional `NEXT_PUBLIC_MOBILE_UPDATE_JSON` vs native version. Shell version from `NovendNative.appInfo` (Cap `App.getInfo` hangs on hosted origin).                                                                                                                                 |
| Weighing scale          | **Not wired.** `sell_by_weight` uses manual qty at checkout. Capability `scale_hardware` + `Hardware.scale` adapter are deferred (Settings → Future devices).                                                                                                                      |

Permissions are requested on tap (or when enabling a feature), never at cold
start except optional biometric unlock when the user opted in.

After the WebView leaves `https://localhost` for the hosted origin, official
Capacitor plugins and custom Novend plugins often hang the **single-threaded
bridge**. `withTimeout` does not cancel the native call — the UI stays frozen
until the app is force-closed.

Critical paths stay off the hung plugin bridge: getUserMedia for camera,
`window.NovendNative` for Downloads, share, notification state, biometric
status/prompt, **app info / update version**, **Classic Bluetooth SPP print**,
and device-local prefs (`localStorage` instead of Cap Preferences).

Nearby BLE Discover still uses `@capacitor-community/bluetooth-le` and may
time out on hosted Cap — prefer **Android paired (Classic)** in Hardware.

## Desktop registry

`apps/desktop/src/hardware/registry.ts` remains the native discovery and print
entry point behind the Electron adapter.

## Barcode scanning

```text
Barcode service (services/hardware)
 ├── HID / keyboard wedge (Electron + browser)
 ├── Camera web (Barcode Detection API / ZXing)
 └── Capacitor camera (ZXing, 640×480, 50ms decode interval — offline-safe)
```

- Optional `products.barcode`, unique per organization
- Terminal preference: `novend.terminal.scanner` in localStorage (desktop HID)
- Scan lookup never calls Convex — `findLocalProductsByBarcode` uses Dexie

## Product images

Upload / Take Photo / Choose Gallery → compress → `putProductImage` (blob +
thumbnail in IndexedDB) → outbox upload when online. Capacitor also keeps a
filesystem copy so temporary camera URIs are not the only source of truth.

## Permissions

Electron grants `media` on the `persist:novend` partition. Capacitor declares
camera, media, Bluetooth, notifications, and biometric permissions in the
Android manifest. iOS usage strings are documented in `apps/mobile/ios/README.md`
and applied when the iOS project is generated on macOS.
