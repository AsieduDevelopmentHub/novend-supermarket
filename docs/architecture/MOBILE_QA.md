# Mobile QA checklist (Phase 4)

Manual production audit before Play Store / App Store submission. No feature
should require internet before becoming usable after the first online sign-in.

## Device prep

- [ ] Fresh install of Capacitor Android build (`versionName` 0.4.0+)
- [ ] Sign in once online, then enable airplane mode for offline checks
- [ ] Pair a 58mm or 80mm Bluetooth ESC/POS printer (optional for print rows)

## Core offline

- [ ] Offline sale → receipt → inventory decrement locally
- [ ] Held sale resume offline
- [ ] Sync recovers when online (outbox drains)
- [ ] App restart restores session from local cache
- [ ] Device rotation keeps cart / forms usable

## Hardware

- [ ] Camera barcode scan from Products and Sales
- [ ] Product Take Photo / Choose Gallery
- [ ] Bluetooth discover → pair → test print → sale print (one copy)
- [ ] After-sale mode: Automatic prints immediately; Manual offers Print first; Do not print does not auto-print
- [ ] Receipt Share / Save PDF remain optional after checkout
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
