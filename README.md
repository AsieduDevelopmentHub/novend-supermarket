# Novend POS

Commercial offline-first Point of Sale and business management platform
(Nova + Vend). Multi-tenant productization of the Princellen POS architecture.

See `overview.md` for product vision and `docs/PROJECT_CONSTITUTION.md` for
engineering authority.

## Stack

Next.js · Convex · TypeScript · Tailwind CSS · Dexie · pnpm

## Develop

```bash
pnpm install
npx convex dev
pnpm dev
```

Copy `.env.example` to `.env.local`. Convex codegen (`convex/_generated`) is refreshed by `npx convex dev`.

First-time flow: sign up → create organization → add products → sell.
