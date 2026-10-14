# Millie's Supermarket POS

Single-store, supermarket Point of Sale for **Millie's Supermarket**. Local-first
on the till (Dexie); Convex is used for sign-in and licence bootstrap only.
Receipts end with `Powered by Novend POS`.

Full stack and workflow overview:

**[`docs/MILLIES_OVERVIEW.md`](./docs/MILLIES_OVERVIEW.md)**

## Stack (short)

| Piece | Role |
| --- | --- |
| Next.js + React + TypeScript | App UI |
| Tailwind v4 | Millie's red `#ED0206` / navy `#012561` |
| Dexie | Business data on this device |
| Convex | Auth + licence (`local_only`) |
| Electron / Capacitor | Desktop and Android shells |

## Develop

```bash
pnpm install
pnpm dev:all
pnpm test
```

## Docs

| Doc | Purpose |
| --- | --- |
| [`docs/MILLIES_OVERVIEW.md`](./docs/MILLIES_OVERVIEW.md) | How Millie's POS works |
| [`docs/PROJECT_CONTEXT.md`](./docs/PROJECT_CONTEXT.md) | Short product context |
| [`docs/PROJECT_CONSTITUTION.md`](./docs/PROJECT_CONSTITUTION.md) | Engineering authority |
| [`docs/design/branding/colors.md`](./docs/design/branding/colors.md) | Logo palette |
| [`docs/architecture/OFFLINE_SYNC.md`](./docs/architecture/OFFLINE_SYNC.md) | Local-only detail |
