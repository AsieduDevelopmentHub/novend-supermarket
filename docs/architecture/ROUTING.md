# Routing

Version: 1.3.6

## Public vs authenticated entry

```text
/                    Public SaaS landing (web only)
/login               Authentication
/signup              Account creation (requires Terms + Privacy acceptance)
/forgot-password     Password reset request (generic success; no email enumeration)
/reset-password      Complete reset with a single-use token
/download            Public app downloads (live release feed)
/docs, /privacy…     Public marketing site pages
/(app)/*             Authenticated POS shell
```

**Web (single origin):** Authenticated visits to `/` 302 into the POS shell
(`/dashboard`, `/platform`, or `/onboarding`). This protects Cap/Electron cold
starts that used to paint the marketing page as the app shell.

**Web (host split):** Set `NEXT_PUBLIC_MARKETING_URL` and `NEXT_PUBLIC_APP_URL`
(or `NOVEND_APP_URL`) to different origins. On the marketing host, `/` stays the
landing even when signed in. On the app host, authenticated `/` still redirects.
Leave marketing unset (or equal to the app URL) to keep single-origin behavior.

**Native shells:** Capacitor and Electron must use the **app** origin
(`NOVEND_APP_URL` → `app.…`), never the marketing landing. They already boot to
`/dashboard?fromBoot=1`.

**Downloads:** `/download` lists the latest stable desktop installers and mobile
APK/store links from the live release registry. Settings → Downloads shows the
same feeds inside the app. Marketing “Download” CTAs should point here — not
only to `/#desktop`. Capacitor and Electron boot pages do not wait on
`/api/health` — they open `/dashboard?fromBoot=1` so a registered service
worker can serve Cache Storage on a weak or dead radio. `/api/health` remains
a public CORS probe for diagnostics. `/api/boot` remains a trampoline for
poisoned older workers (they skip `/api/*`).

**Desktop app:** Boots to `/dashboard` via `offline-boot.html` — never the
landing page. The landing client also redirects if `window.novendDesktop` is
present. See `docs/architecture/DESKTOP_PLATFORM.md`.

## Route groups

```text
app/page.tsx                 # Public marketing landing
app/(site)/download
app/(site)/docs
app/(site)/docs/help
app/(site)/docs/releases
app/(site)/privacy
app/(site)/terms
app/(site)/refund
app/(site)/cookies
app/(site)/aup
app/(site)/dpa
app/(auth)/login
app/(auth)/signup
app/(auth)/forgot-password
app/(auth)/reset-password
app/(auth)/onboarding
app/(app)/platform
app/(app)/dashboard
app/(app)/sales
app/(app)/orders
app/(app)/orders/[id]
app/(app)/inventory
app/(app)/products
app/(app)/products/[id]
app/(app)/customers
app/(app)/customers/[id]
app/(app)/users
app/(app)/users/[id]
app/(app)/settings
```

Navigation: `config/navigation.ts` (permission-aware). Marketing copy:
`features/marketing/`. Host helpers: `lib/hosting/hosts.ts`.

## Gates

- Unauthenticated on protected routes → `/login`
- Unauthenticated may access `/`, `/login`, `/signup`, `/forgot-password`,
  `/reset-password`, `/download`, `/docs(.*)`, `/privacy`, `/terms`, `/refund`,
  `/cookies`, `/aup`, and `/dpa`
- Authenticated on `/` (app host / unsplit) → `/platform`, `/onboarding`, or
  `/dashboard`
- Authenticated on `/` (dedicated marketing host) → landing stays
- Authenticated on `/login` or `/signup` → `/platform` (platform admin),
  `/onboarding` (needs a business), or `/dashboard`
- Authenticated without profile → `/onboarding`
- Inactive organization or profile → blocked message
- `/users` — administrator or manager (proxy + server auth)

## MVP stubs

Reports, analytics, returns, and branches routes are omitted until later slices.
