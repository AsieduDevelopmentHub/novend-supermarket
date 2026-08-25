# iOS native project

Generate a full iOS project on macOS (Capacitor does not complete iOS on Windows):

```bash
pnpm --filter @novend/mobile add:ios
pnpm --filter @novend/mobile sync:ios
```

On Windows, `pnpm mobile:sync` syncs **Android only** (`cap sync android`). A partial
`ios/` stub without a Podfile will make `cap sync` (all platforms) fail — use
`sync:ios` on a Mac after `add:ios`.

## Privacy descriptions (Info.plist)

When the iOS project exists, set:

| Key                                     | Suggested copy                                                      |
| --------------------------------------- | ------------------------------------------------------------------- |
| `NSCameraUsageDescription`              | Novend uses the camera to scan barcodes and capture product photos. |
| `NSPhotoLibraryUsageDescription`        | Novend lets you choose product photos from your library.            |
| `NSBluetoothAlwaysUsageDescription`     | Novend connects to Bluetooth thermal printers for receipts.         |
| `NSBluetoothPeripheralUsageDescription` | Novend connects to Bluetooth thermal printers for receipts.         |
| `NSFaceIDUsageDescription`              | Novend can unlock with Face ID after you sign in.                   |

Also register the URL scheme `novend` for deep links (`novend://sale/…`).

Until then, Android (`../android`) is the initialized Capacitor platform.
