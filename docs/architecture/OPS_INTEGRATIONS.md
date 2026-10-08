# Ops integrations (Arkesel, Sentry, Google Analytics)

All three are **opt-in**. Missing env keys skip cleanly — local and production
builds must not crash without them.

## Arkesel SMS

| Item | Value |
| ---- | ----- |
| Purpose | Transactional / alert SMS (Ghana and Arkesel markets) |
| Code | `convex/shared/arkeselSms.ts`, `convex/sms.ts` |
| Secrets | Convex deployment env (never Next / client) |

```bash
npx convex env set ARKESEL_API_KEY "<dashboard key>"
npx convex env set ARKESEL_SENDER_ID "Novend"
```

- `api.sms.broadcast` — platform owner/operator message to business owners, administrators, or managers. Cashiers are excluded. One organization or all businesses.
- `internal.sms.notifyCashierClockIn` — one SMS to that business's administrators the first time a cashier signs in on a business day. Later logins the same day do not send again.
- `internal.sms.sendBestEffort` — for other digests (no throw).
- Without `ARKESEL_API_KEY`, sends return `{ status: "skipped" }`.

Register the sender ID in the Arkesel dashboard before production traffic.

## Sentry

| Item | Value |
| ---- | ----- |
| Purpose | Client + server error monitoring |
| Code | `lib/monitoring/sentry.ts`, `instrumentation.ts`, `instrumentation-client.ts` |
| Env | `NEXT_PUBLIC_SENTRY_DSN` (required to enable), optional `SENTRY_AUTH_TOKEN` for CI maps |

Auth headers are stripped in `beforeSend`.
`next.config.ts` wraps with `withSentryConfig` (from `@sentry/nextjs/config`) only when the DSN is present.

## Google Analytics 4

| Item | Value |
| ---- | ----- |
| Purpose | Marketing page views, plus named funnel events |
| Code | `lib/analytics/google-analytics.tsx`, `lib/analytics/ga-events.ts` |
| Env | `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-…` |

Automatic page views stay on the marketing site. The POS shell does not send
screen views or sale data. Funnel events send no email, name, or phone:

| Event | When |
| ----- | ---- |
| `sign_up` | Account created |
| `login` | Password sign-in (cloud or offline) |
| `start_free_trial` | Click a `/signup` link |
| `contact_whatsapp` | WhatsApp link |
| `contact_sales` | Sales mailto, or contact form topic Sales |
| `download_desktop` | Desktop installer download |
| `download_android` | APK or Play Store link |
| `install_pwa` | Accepted install prompt or `appinstalled` |
| `pricing_view` | Public pricing page |
| `demo_request` | “Talk to sales” on the demo page |
| `onboarding_started` | Business setup form shown |

## CSP

`proxy.ts` allowlists:

- Sentry ingest hosts on **app** and **marketing** `connect-src`
- Google Analytics collect hosts on `connect-src` and `img-src` (funnel beacons)
- Google Tag Manager script hosts on **marketing** `script-src` (auth/app load gtag only through nonce + strict-dynamic when an event fires)

## Enabling in production

1. Set Convex `ARKESEL_API_KEY` (+ optional `ARKESEL_SENDER_ID`) for SMS.
2. Set Vercel `NEXT_PUBLIC_SENTRY_DSN` (and optional `SENTRY_AUTH_TOKEN` in CI).
3. Set Vercel `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-…` for the marketing site.

Leave any key unset to keep that integration dormant.
