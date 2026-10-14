# Novend POS

## Development Guide

Version: 1.0.3

# Purpose

Engineering entry point. Detailed standards live under `docs/architecture/`,
`docs/design/`, `docs/development/`, and `docs/business/`.

# Authority order

1. `MILLIES_OVERVIEW.md` — product stack and how the till works
2. `PROJECT_CONSTITUTION.md`
3. `PROJECT_CONTEXT.md`
4. `BUSINESS_GLOSSARY.md`
5. `FOLDER_STRUCTURE.md`
6. This guide and satellite docs

# Stack

- Next.js App Router (TypeScript)
- Convex (auth + licence bootstrap; business mode is `local_only`)
- Tailwind CSS v4 + Millie's red/navy tokens
- Dexie (IndexedDB) as on-till business source of truth
- pnpm

Full picture: [`MILLIES_OVERVIEW.md`](./MILLIES_OVERVIEW.md).

# Scripts

```bash
pnpm install
pnpm dev:all          # Next + Convex
pnpm typecheck
pnpm lint
```

# Git

```text
feature/* → PR → staging → CI / review → PR → main → production
```

Never push directly to `main`. Feature work targets `staging`. Open a PR into
`main` only for a product release. Squash-merge `staging` → `main` so production
history stays one commit per release. GitHub Actions then **merge-commits** that
squash back into `staging`. Squash is what keeps `main` clean; the sync is what
prevents the next release PR from conflicting. If the sync opens a PR, merge it
with a merge commit (do not squash the sync).

CI job **`quality`** (lint, typecheck, tests, audit, hygiene, build) must pass
before merging to `staging` or `main`. Enabling GitHub branch protection /
rulesets on this private repo requires GitHub Pro or a public repository.

# Lifecycle

```text
Understand → Analyze → Plan → Inspect existing code → Design
→ Implement → Review → Refine
```

# Principles

- Clarity over cleverness
- Business logic in Convex, not in the UI
- Reuse before creating
- Respect the design system
- Document architectural decisions
- Never commit secrets

# Required reading for AI and engineers

1. Constitution
2. Context
3. Folder structure
4. Multi-tenant architecture
5. Offline sync
6. Security guide
7. Design system
