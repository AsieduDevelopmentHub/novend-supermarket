# Mobile updates via Convex

Android APKs (and optional store links) publish through the same release pipeline as desktop
installers. Convex stores metadata and redirects downloads — clients never call the GitHub
Releases API directly.

```
Tag v* → GitHub Actions builds desktop + Android APK
      → publish job posts metadata to Convex
      → /download page and in-app checks read
        {CONVEX_SITE_URL}/mobile-updates/...
```

## Convex environment

Mobile publishing reuses the desktop release secrets:

- `DESKTOP_RELEASE_PUBLISH_SECRET` — bearer token for `/mobile-updates/publish`
- `DESKTOP_RELEASE_GITHUB_TOKEN` — PAT for private GitHub Release asset redirects
- `CONVEX_SITE_URL` — your `*.convex.site` origin

See `docs/development/DESKTOP_UPDATES.md` for generating and verifying these values.

## GitHub Actions secrets

Required (same as desktop):

- `CONVEX_SITE_URL`
- `DESKTOP_RELEASE_PUBLISH_SECRET`

Optional:

- `NOVEND_APP_URL` — baked into the Capacitor shell at sync time (defaults to production)
- `MOBILE_ANDROID_STORE_URL` — Play Store listing when published
- `MOBILE_IOS_STORE_URL` — App Store listing when published
- `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` — release signing; without these CI signs with the debug keystore for sideload builds

## Local Android build

Use **JDK 21** (same as CI). Android Studio’s bundled JBR may be newer (e.g. 25) and will fail Gradle 8.11 with `Unsupported class file major version`.

```bash
# Windows (PowerShell) after installing Microsoft OpenJDK 21
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
pnpm mobile:sync
cd apps/mobile/android
.\gradlew.bat assembleRelease --no-daemon
```

APK output: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

## HTTP endpoints

| Path | Purpose |
|------|---------|
| `POST /mobile-updates/publish` | CI metadata ingest |
| `GET /mobile-updates/latest` | Public JSON for in-app update checks |
| `GET /mobile-updates/assets/{version}/{file}` | Redirect to GitHub Release asset |

Point `NEXT_PUBLIC_MOBILE_UPDATE_JSON` at `{CONVEX_SITE_URL}/mobile-updates/latest` when
baking native shell config if you want Capacitor to compare shell version against published
APK metadata.

## Manual republish

```bash
pnpm mobile:publish-convex
```

Requires `CONVEX_SITE_URL`, `DESKTOP_RELEASE_PUBLISH_SECRET`, `GH_TOKEN`, and `RELEASE_TAG`.

## Asset naming

CI uploads `NovendPOS-{version}-android.apk` to the GitHub Release. The publish script
classifies `.apk`, `.aab`, and `.ipa` assets automatically.
