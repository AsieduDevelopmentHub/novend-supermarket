# GPT Production Audit Implementation

Implementation date: 2026-08-26  
Source audit: [`gpt.md`](./gpt.md)  
Related baseline audit: [`audit.md`](./audit.md)

## Root Causes And Fixes

| Area                  | Root cause                                                                                                                        | Implementation                                                                                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WebView/PWA boot      | Capacitor boot fetched the hosted route and navigated even after a failed request, exposing Chromium's native error page.         | Boot now checks `response.ok`, stays on a local retry screen for failures/timeouts/offline state, and retries on user action or `online`.                                                                      |
| Platform performance  | Cache data was available, but wrapper hooks kept `loading=true` while Convex refreshed.                                           | Cached IndexedDB data renders immediately; live refresh is background-only.                                                                                                                                    |
| Mobile cart/checkout  | Full-width CTA and partially-open native snap point made checkout hard to use.                                                    | Compact cart icon with count badge (including zero); checkout drawer uses bounded dynamic viewport height and safe-area padding.                                                                               |
| Shared dialogs/toasts | Close controls had low contrast/small hit targets; mobile toasts ignored status/header insets.                                    | Shared dialog/sheet close controls are visible 36px controls with border/background; mobile Sonner offset includes safe area and header clearance.                                                             |
| Native version        | Failed/stale remote metadata was treated as “latest”; comparison lived inline and accepted malformed values.                      | Native `App.getInfo()` remains installed-version authority; update checks are cache-busted, versions are strictly normalized, and unavailable/malformed metadata is `unknown`. About displays verified status. |
| Biometrics            | Later timeout/support mapping could report unsupported hardware when the plugin exposed a supported type through `biometryTypes`. | Adapter resolves primary and alternate biometry types, uses bounded calls, and preserves fail-soft unlock behavior.                                                                                            |
| Notifications         | Permanent denial was inferred from local request-attempt count, producing bogus errors after upgrades.                            | Android rationale/native permission facts are authoritative; app-side counters were removed. Permission mapping is unit-tested and tolerant of old preference stores.                                          |
| Security offline      | Remote `users.me` could remain pending and leave a permanent account-loading state.                                               | Native controls render independently; password section now explains sync state and never blocks the page.                                                                                                      |
| Legal/support         | Public marketing shell and landing link were always shown in app runtimes.                                                        | Site shell/page detect Capacitor, Electron, and standalone PWA and render content without marketing navigation/footer/back link.                                                                               |
| Receipt share/print   | Capacitor share was text-only and mobile receipt views omitted print.                                                             | Native share calls are bounded; failed text share falls back to saved PDF/content URI; print is available in preview and post-sale dialogs and retains browser/Electron fallback.                              |
| Login routing         | `RestoreLastRoute` and `next` paths could leak a previous user's platform/deep route.                                             | Native route restoration is removed from app services; successful auth resolves to `/dashboard` (or onboarding when required), and logout still clears route/offline state.                                    |

## Regression Evidence

The `v0.3.0` to `v0.3.1` diff changed package/native version metadata (`versionName` and Android `versionCode`) but did not change biometric, notification, share, or print implementations. The bogus native behavior entered in subsequent permission/timeout revisions (`f0bd919`, `984f735`, and related commits); fixes therefore retain the current plugin architecture while correcting state mapping and timeout handling.

## Verification

- Focused auth and native-version/permission tests pass.
- Full Vitest suite passes: 26 files, 135 tests.
- Full TypeScript, ESLint, Prettier, and `git diff --check` gates pass.
- Production `next build` passes without a network dependency on Google Fonts.
- Real-device acceptance remains required for biometric prompts, Android notification rationale/settings transitions, Bluetooth ESC/POS printing, Android share targets, and offline Capacitor cold start.
- Android Gradle compilation was attempted but the sandbox blocked downloading the configured Gradle distribution; run the mobile compile/release gate on a networked Android/JDK 21 environment.

## Release Notes

The deep source audit now lives at [`docs/gpt.md`](./gpt.md). The earlier baseline audit is at [`docs/audit.md`](./audit.md); this report is the implementation record for the deep production regression audit.
