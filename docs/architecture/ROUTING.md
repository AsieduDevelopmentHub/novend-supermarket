# Routing

Version: 1.3.9

## Public vs authenticated entry

```text
/                    Public SaaS landing (web only)
/login               Authentication
/signup              Account creation (requires Terms + Privacy acceptance)
/forgot-password     Password reset request (generic success; no email enumeration)
/reset-password      Complete reset with a single-use token
/download            Public app downloads (live release feed)
/pricing             Public plan comparison (no account)
/product, /product/* Public product marketing pages (not `/products` catalog)
/docs, /privacy…     Public marketing site pages
/(app)/*             Authenticated POS shell
```

### Static marketing vs dynamic app layout

- **Root** (`app/layout.tsx`) does **not** call `headers()` or read a CSP nonce, so
  the landing page and `(site)/*` marketing tree can stay static/cache-friendly.
  `AppProviders` stays at the root (stable Convex client across navigations).
- **App / auth** (`app/(app)/layout.tsx`, `app/(auth)/layout.tsx`) read `x-nonce`
  and feed `NonceProvider` + `ThemeBootScript` so nonce CSP still covers theme
  boot on dynamic shells.
- **`proxy.ts`** uses a **static CSP** (no per-request nonce) for public marketing
  routes and short-circuits without `users.me` / session work, except `/` (Cap
  authenticated home redirect) and login pages (post-auth redirect). App routes
  keep nonce + `strict-dynamic` CSP. Backend authz is unchanged.

**Web (single origin):** Authenticated visits to `/` 302 into the POS shell
(`/dashboard`, `/platform`, or `/onboarding`). This protects Cap/Electron cold
starts that used to paint the marketing page as the app shell.

**Web (host split):** Production uses two hosts on the same Next deploy:

```text
https://www.novendpos.app        Marketing (landing, pricing, product, docs)
https://dashboard.novendpos.app  POS / auth (/login, /signup, /dashboard, …)
https://novendpos.app            Edge redirect → www
```

Set `NEXT_PUBLIC_MARKETING_URL=https://www.novendpos.app` and
`NEXT_PUBLIC_APP_URL=https://dashboard.novendpos.app` (also
`NEXT_PUBLIC_SITE_URL` for SEO). Marketing **Sign in** / **Start free** CTAs
use `appEntryHref()` so they open the dashboard host—not a relative `/login` on
www. On the marketing host, authenticated `/` stays the landing. On the app
host, authenticated `/` still 302s into the POS shell. Leave marketing unset
(or equal to the app URL) for single-origin localhost.

**Convex Auth:** `npx convex env set SITE_URL https://dashboard.novendpos.app`
— auth cookies and post-login redirects must use the **app** origin, not www.

**Native shells:** Capacitor and Electron must use the **app** origin
(`NOVEND_APP_URL` → `dashboard.novendpos.app`), never the marketing landing.
They already boot to `/dashboard?fromBoot=1`.

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
app/(site)/pricing
app/(site)/product
app/(site)/product/[slug]
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
  `/reset-password`, `/download`, `/pricing`, `/product`, `/product/*`,
  `/docs(.*)`, `/privacy`, `/terms`, `/refund`, `/cookies`, `/aup`, and `/dpa`
  (`/products` remains authenticated catalog)
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
