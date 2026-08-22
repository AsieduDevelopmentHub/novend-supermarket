# Hardware architecture

Version: 1.1.0

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
 ├── HID / keyboard wedge (Electron + browser)
 └── Camera (Barcode Detection API — desktop, web, PWA)
```

- Optional `products.barcode`, unique per organization. Empty is allowed.
- Terminal preference: `novend.terminal.scanner` in localStorage (enable, device, last scan)
- Settings → Hardware → Barcode Scanner: enable, discover USB (desktop), test HID, test camera
- POS sales: always-on HID. One Dexie match → cart; many → picker; none → “Product not found”
- Product create/edit: HID listens only after **Scan barcode** (≈18s) or **Use camera**
- Products, inventory, and wholesale search fields accept HID + camera and filter the Dexie replica
- Scan lookup never calls Convex — `findLocalProductsByBarcode` uses the Dexie barcode/SKU index

## Product images

Upload or Take Photo (webcam via `getUserMedia`). Images are compressed
client-side (`lib/uploads/image.ts`) before Convex storage so catalog sync stays
lightweight. Catalog rows cache `imageUrl` in Dexie for offline sales.

## Permissions

Electron grants `media` on the `persist:novend` partition so Take Photo works
in the desktop shell without a separate native camera module.
