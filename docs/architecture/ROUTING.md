# Routing

Version: 1.3.4

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

**Web:** `/` is always the public marketing landing, including for signed-in
users. Login and Get Started CTAs go to `/login` or `/signup`. After sign-in,
platform administrators go to `/platform`; other users go to `/dashboard` (or
`/onboarding` when they still need a business).

**Downloads:** `/download` lists the latest stable desktop installers and mobile
APK/store links from the live release registry. Settings → Downloads shows the
same feeds inside the app. Marketing “Download” CTAs should point here — not
only to `/#desktop`. `/api/health` is a public CORS probe used by Cap/Electron
boot pages before they navigate to the hosted origin. Capacitor then opens
`/api/boot` (public HTML trampoline) so an old service worker can be unregistered
before `/dashboard` — older workers skip `/api/*` and would otherwise paint
`ERR_FAILED` on the login → dashboard redirect.

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
`features/marketing/`.

## Gates

- Unauthenticated on protected routes → `/login`
- Unauthenticated may access `/`, `/login`, `/signup`, `/forgot-password`,
  `/reset-password`, `/download`, `/docs(.*)`, `/privacy`, and `/terms`
- Authenticated may still open `/` (landing is never redirected away)
- Authenticated on `/login` or `/signup` → `/platform` (platform admin),
  `/onboarding` (needs a business), or `/dashboard`
- Authenticated without profile → `/onboarding`
- Inactive organization or profile → blocked message
- `/users` — administrator or manager (proxy + server auth)

## MVP stubs

Reports, analytics, returns, and branches routes are omitted until later slices.
