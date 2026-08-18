# Routing

Version: 1.0.0

## Route groups

```text
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

Navigation: `config/navigation.ts` (permission-aware).

## Gates

- Unauthenticated → `/login`
- Authenticated without profile → `/onboarding`
- Inactive organization or profile → blocked message
- `/users` — administrator or manager (proxy + Convex)

## MVP stubs

Reports, analytics, returns, and branches routes are omitted until later slices.
