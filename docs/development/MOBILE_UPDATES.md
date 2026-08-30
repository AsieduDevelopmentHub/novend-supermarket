# Mobile updates via Convex

Android APKs (and optional store links) publish through the same release pipeline as desktop
installers. Convex stores metadata and redirects downloads; clients never call the GitHub
Releases API directly.

```
Tag v* -> GitHub Actions builds Android APK (default)
      -> publish job posts mobile metadata to Convex
      -> /download page and in-app checks read
        {CONVEX_SITE_URL}/mobile-updates/...
```

## Download monitoring

Mobile update checks and asset redirects record privacy-limited platform events
before returning metadata or the GitHub redirect. Asset groups distinguish APK,
AAB, and IPA files. A telemetry failure never blocks download or update checks.
Historical GitHub asset totals can be imported once from Platform Exports.

## Convex environment

Mobile publishing reuses the desktop release secrets:

- `DESKTOP_RELEASE_PUBLISH_SECRET` - bearer token for `/mobile-updates/publish`
- `DESKTOP_RELEASE_GITHUB_TOKEN` - PAT for private GitHub Release asset redirects
- `CONVEX_SITE_URL` - your `*.convex.site` origin

See `docs/development/DESKTOP_UPDATES.md` for generating and verifying these values.

## GitHub Actions secrets

Required (same as desktop):

- `CONVEX_SITE_URL`
- `DESKTOP_RELEASE_PUBLISH_SECRET`

Optional:

- `NOVEND_APP_URL` - baked into the Capacitor shell at sync time (defaults to production)
- `MOBILE_ANDROID_STORE_URL` - Play Store listing when published
- `MOBILE_IOS_STORE_URL` - App Store listing when published
- `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` - required for the signed release APK; CI fails closed when any value is missing

## Local Android build

Use **JDK 21** (same as CI and Capacitor 7 `sourceCompatibility`). `pnpm mobile:run:android`
and `pnpm mobile:build:android:release` resolve Temurin / Microsoft / Android Studio JDK 21
even if the shell `JAVA_HOME` is still 17. Android Studio must also use Gradle JDK 21
(see `docs/architecture/CAPACITOR_MOBILE.md`); `#JAVA_HOME` / Temurin 17 produces
`invalid source release: 21`. Android Studio's bundled JBR may be newer (for example 25)
and will fail Gradle 8.11 with `Unsupported class file major version`.

Create a release keystore once, then copy the signing variables from `.env.example` into the
ignored `.env.local` file. Keep the keystore and passwords out of source control.

**Bash / macOS / Linux** (backslash continues the line):

```bash
keytool -genkeypair -v \
  -keystore apps/mobile/android/release.keystore \
  -alias novend-release \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000
```

**PowerShell (Windows)** — do **not** use `\`; put the command on one line (or use ```):

```powershell
keytool -genkeypair -v -keystore apps/mobile/android/release.keystore -alias novend-release -keyalg RSA -keysize 4096 -validity 10000
```

`keytool` will prompt for:

1. Keystore password (remember this → `ANDROID_KEYSTORE_PASSWORD`)
2. Key password (can match the keystore password → `ANDROID_KEY_PASSWORD`)
3. Name / org details (can be Novend / your company)J

Then add to `.env.local` (never commit this file):

```env
ANDROID_KEYSTORE_PATH=apps/mobile/android/release.keystore
ANDROID_KEYSTORE_PASSWORD=your-keystore-password
ANDROID_KEY_ALIAS=novend-release
ANDROID_KEY_PASSWORD=your-key-password
```

Set `JAVA_HOME` and `ANDROID_HOME`, then run the repository helper:

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
pnpm mobile:build:android:release
```

The helper loads `.env.local`, validates all four signing values, syncs Capacitor, and runs
`assembleRelease`. The APK is written to
`apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.

## GitHub tag releases

The `Product Release` workflow runs for tags matching `v*`. By default it
builds the **Android APK only** and publishes mobile metadata to Convex (no
desktop installers). Use workflow_dispatch with `targets: all` when you also
need Windows/macOS/Linux installers and desktop Convex metadata.

Required signing secrets:

- `ANDROID_KEYSTORE_BASE64` - base64 encoding of the exact release keystore
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Generate the base64 value without putting the binary keystore in Git:

```powershell
$bytes = [IO.File]::ReadAllBytes("apps/mobile/android/release.keystore")
$base64 = [Convert]::ToBase64String($bytes)
gh secreset ANDROID_KEYSTORE_BASE64 --body $base64
gh secret set ANDROID_KEYSTORE_PASSWORD
gh secret set ANDROID_KEY_ALIAS
gh secret set ANDROID_KEY_PASSWORD
```

The workflow decodes the keystore into a runner file, exports `ANDROID_KEYSTORE_PATH`, and
runs `assembleRelease`. It verifies the APK signature and metadata, uploads the APK plus
SHA-256 checksum to the GitHub Release, and then publishes mobile update metadata to Convex.
A missing keystore or signing secret fails the Android job; there is no debug-signing fallback
for release artifacts.

After updating the package version and changelog, squash-merge to `main`, then tag:

```bash
git tag v0.3.10
git push origin v0.3.10
```

## HTTP endpoints

| Path                                          | Purpose                              |
| --------------------------------------------- | ------------------------------------ |
| `POST /mobile-updates/publish`                | CI metadata ingest                   |
| `GET /mobile-updates/latest`                  | Public JSON for in-app update checks |
| `GET /mobile-updates/assets/{version}/{file}` | Redirect to GitHub Release asset     |

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
