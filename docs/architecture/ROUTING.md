# Routing

Version: 1.2.0

## Public vs authenticated entry

```text
/                    Public SaaS landing (web only)
/login               Authentication
/(app)/*             Authenticated POS shell
```

**Web:** `/` is always the public marketing landing, including for signed-in
users. Login and Get Started CTAs go to `/login` or `/signup`. After sign-in,
platform administrators go to `/platform`; other users go to `/dashboard` (or
`/onboarding` when they still need a business).

**Electron:** Boots to `/dashboard` via `offline-boot.html` — never the landing
page. The landing client also redirects if `window.novendDesktop` is present.
See `docs/architecture/DESKTOP_PLATFORM.md`.

## Route groups

```text
app/page.tsx                 # Public marketing landing
app/(auth)/login
app/(auth)/signup
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
- Unauthenticated may access `/`, `/login`, and `/signup`
- Authenticated may still open `/` (landing is never redirected away)
- Authenticated on `/login` or `/signup` → `/platform` (platform admin),
  `/onboarding` (needs a business), or `/dashboard`
- Authenticated without profile → `/onboarding`
- Inactive organization or profile → blocked message
- `/users` — administrator or manager (proxy + Convex)

## MVP stubs

Reports, analytics, returns, and branches routes are omitted until later slices.
