# Routing

Version: 1.1.0

## Public vs authenticated entry

```text
/                    Public SaaS landing (web only)
/login               Authentication
/(app)/*             Authenticated POS shell
```

**Web:** Unauthenticated users may open `/` (marketing). Authenticated visits to
`/` redirect to `/dashboard`. Login and Get Started CTAs go to `/login`.

**Electron:** Boots to `/dashboard` via `offline-boot.html` — never the landing
page. The landing client also redirects if `window.novendDesktop` is present.
See `docs/architecture/DESKTOP_PLATFORM.md`.

## Route groups

```text
app/page.tsx                 # Public marketing landing
app/(auth)/login
app/(auth)/signup
app/(auth)/onboarding
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
- Unauthenticated may access `/` and `/login`
- Authenticated on `/` or `/login` → `/dashboard`
- Authenticated without profile → `/onboarding`
- Inactive organization or profile → blocked message
- `/users` — administrator or manager (proxy + Convex)

## MVP stubs

Reports, analytics, returns, and branches routes are omitted until later slices.
