# Hardware architecture

Version: 1.0.0

## Purpose

Manage POS peripherals through a modular desktop hardware layer and a Settings
→ **Hardware** UI. Printers and barcode scanners ship first; cash drawers,
customer displays, scales, and label printers plug into the same registry.

## Layers

```text
Settings → Hardware (Printer / Scanner / Future)
        ↓
services/hardware + services/print  (renderer contracts + localStorage)
        ↓
window.novendDesktop (preload)
        ↓
apps/desktop IPC → hardware/registry
        ↓
adapters: printers/* · scanners/*
```

## Desktop registry

`apps/desktop/src/hardware/registry.ts` is the single discovery and capability
entry point:

- `discoverDevices()` — Windows printers + scanner adapters
- `listCapabilities()` — which device kinds are available
- `printReceiptJob` / `runTestPrint` — ESC/POS execution

New hardware kinds register an adapter under `hardware/<kind>/` and appear in
discovery without changing the Settings tree structure.

## Barcode scanning

```text
Barcode service (services/hardware)
 ├── Electron HID / keyboard wedge (current)
 └── Mobile camera scanner (future)
```

- Terminal preference: `novend.terminal.scanner` in localStorage
- POS uses `useBarcodeScanner` + offline Dexie SKU lookup
- One match → cart; many → selection dialog; none → “Product not found”

## Product images

Upload or Take Photo (webcam via `getUserMedia`). Images are compressed
client-side (`lib/uploads/image.ts`) before Convex storage so catalog sync stays
lightweight. Catalog rows cache `imageUrl` in Dexie for offline sales.

## Permissions

Electron grants `media` on the `persist:novend` partition so Take Photo works
in the desktop shell without a separate native camera module.
