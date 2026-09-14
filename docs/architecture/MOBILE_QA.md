# Mobile QA checklist (Phase 4)

Manual production audit for the **Android** Capacitor app (sideloaded APK today;
Play Store when published). iOS customers use the Home Screen PWA / Cap build for
BLE only — Classic SPP is Android-only. No feature should require internet before
becoming usable after the first online sign-in.

## Device prep

- [ ] Fresh install of Capacitor Android build (`versionName` matches root `package.json`)
- [ ] Sign in once online, then enable airplane mode for offline checks
- [ ] BLE ESC/POS printer available (58mm and/or 80mm)
- [ ] Classic RFCOMM/SPP printer available (Android): pair in system Bluetooth settings first

## Core offline

- [ ] Offline sale → receipt → inventory decrement locally
- [ ] Held sale resume offline
- [ ] Sync recovers when online (outbox drains)
- [ ] App restart restores session from local cache
- [ ] Device rotation keeps cart / forms usable

## Hardware — Bluetooth printing

- [ ] **BLE:** Discover → Connect → Test print → sale print (one copy)
- [ ] **Classic SPP (Android):** Open Bluetooth settings → pair → List paired → Connect → Test → sale print
- [ ] Hardware paper width 58/80 matches physical columns for test **and** sale print
- [ ] Cold start with saved printer: status shows Saved (not falsely Connected); Reconnect works
- [ ] Auto-reconnect on: printer sleep / out of range fails once then recovers or shows Needs attention
- [ ] Bluetooth off / permission denied show clear cashier copy (not raw OS errors)
- [ ] Two rapid Print taps do not interleave receipts
- [ ] After-sale mode: Automatic prints immediately; Manual offers Print first; Do not print does not auto-print
- [ ] Automatic failure opens sheet with Retry / Hardware settings / Share / Save PDF
- [ ] Offline completed sale still prints when the printer is in range
- [ ] Receipt Share / Save PDF remain optional and are never treated as thermal print success
- [ ] Camera barcode scan from Products and Sales
- [ ] Product Take Photo / Choose Gallery
- [ ] Denied camera permission shows friendly copy (not raw OS error)

## Security & services

- [ ] Enable biometrics; require on launch; unlock works; password never stored
- [ ] “Continue with password session” bypass still works
- [ ] Soft update sheet appears when `NEXT_PUBLIC_MOBILE_UPDATE_JSON` reports a newer version
- [ ] Notification permission + topic toggles persist
- [ ] Deep link `novend://sale/{id}` opens the order route
- [ ] Backup save → share → restore replaces local data as expected

## System

- [ ] About page shows version, build, org, sync status
- [ ] Low storage / large catalog still opens Sales within acceptable time
- [ ] Background → foreground does not clear cart unexpectedly

Sign-off: _____________ Date: _____________
