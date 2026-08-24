# Hardware architecture

Version: 1.4.1

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
        └── Capacitor adapter → Camera, ML Kit, BLE print, Filesystem,
                                Share, Biometrics, Secure Storage,
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
- Capacitor Camera / ML Kit / BLE adapters load **lazily** — importing
  `@novend/hardware` for biometrics must not evaluate Camera or BLE
- Result types shared across adapters

UI components must not call Electron preload or Capacitor plugins directly.

## Capacitor (Phase 4)

| Feature | Behavior |
|---------|----------|
| Camera / gallery | `@capacitor/camera` → `File` → compress + Dexie image cache |
| Local image durability | Also written under Capacitor `Directory.Data` (`product-images/`) |
| Barcode | `@capacitor-mlkit/barcode-scanning` full-screen `scan()` |
| Bluetooth thermal print | `@capacitor-community/bluetooth-le` ESC/POS write |
| Save PDF / backup JSON | `Directory.Documents` via Filesystem (+ optional Share) |
| Share receipt | Native share sheet |
| Biometrics | `@aparajita/capacitor-biometric-auth` — unlock token only (never password) |
| Secure storage | `@aparajita/capacitor-secure-storage` for unlock token |
| Notifications | `@capacitor/local-notifications` + topic prefs (push foundation) |
| Deep links | `novend://sale/…`, `novend://product/…` via `Hardware.app` |
| Soft updates | Optional `NEXT_PUBLIC_MOBILE_UPDATE_JSON` vs native version |

Permissions are requested on tap (or when enabling a feature), never at cold
start except optional biometric unlock when the user opted in.

## Desktop registry

`apps/desktop/src/hardware/registry.ts` remains the native discovery and print
entry point behind the Electron adapter.

## Barcode scanning

```text
Barcode service (services/hardware)
 ├── HID / keyboard wedge (Electron + browser)
 ├── Camera web (Barcode Detection API / ZXing)
 └── Capacitor native ML Kit scanner
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
