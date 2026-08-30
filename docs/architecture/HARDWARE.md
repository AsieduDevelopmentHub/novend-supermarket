# Hardware architecture

Version: 1.4.5

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
                                Filesystem, Share, Biometrics, Secure Storage,
                                Local Notifications, App deep links
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

| Feature                 | Behavior                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Camera / gallery        | `@capacitor/camera` `getPhoto` (Base64). Permission is requested by the native camera, not a pre-check that can block launch. |
| Save PDF                | Native `NovendPrint.savePdfToDownloads` (MediaStore Downloads) with Cache fallback                                          |
| Share receipt           | Cache PDF + `file://` FileProvider URI (never MediaStore `content://` from Downloads). Text-only is fallback only.          |
| Print (no BLE printer)  | Android `PrintManager` via `NovendPrint.printPdf` (base64 or resolved `_capacitor_file_` path). Not `window.print()`.       |
| Local image durability  | Also written under Capacitor `Directory.Data` (`product-images/`)                                                  |
| Barcode (camera)        | Cap camera permission → getUserMedia → bundled **ZXing** (no Google ML Kit / HTTPS module)                         |
| Barcode (HID)           | Terminal wedge config + `useBarcodeScanner` (desktop primary)                                                      |
| Bluetooth thermal print | `@capacitor-community/bluetooth-le` ESC/POS write. After-sale print mode (automatic / manual / never) applies. One copy. |
| Biometrics              | `@aparajita/capacitor-biometric-auth` — unlock token only (never password); maps supported / enrolled / available  |
| Secure storage          | `@aparajita/capacitor-secure-storage` for unlock token                                                             |
| Notifications           | `NovendPermissions` Android 13+ prompt (LocalNotifications fallback) + channel + topic prefs                       |
| Deep links              | `novend://sale/…`, `novend://product/…` via `Hardware.app`                                                         |
| Soft updates            | Optional `NEXT_PUBLIC_MOBILE_UPDATE_JSON` vs native version                                                        |

Permissions are requested on tap (or when enabling a feature), never at cold
start except optional biometric unlock when the user opted in.

`MainActivity` registers only `NovendPermissions` and `NovendPrint`. Camera,
Share, BLE, biometrics, and Local Notifications load from `capacitor.plugins.json`.
Do not re-register those to “fix” unimplemented errors — that usually means the
WebView left the local boot origin without plugin allow-navigation.

## Desktop registry

`apps/desktop/src/hardware/registry.ts` remains the native discovery and print
entry point behind the Electron adapter.

## Barcode scanning

```text
Barcode service (services/hardware)
 ├── HID / keyboard wedge (Electron + browser)
 ├── Camera web (Barcode Detection API / ZXing)
 └── Capacitor camera (ZXing only — offline-safe)
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
