# Novend POS

## Development Guide

Version: 1.0.2

# Purpose

Engineering entry point. Detailed standards live under `docs/architecture/`,
`docs/design/`, `docs/development/`, and `docs/business/`.

# Authority order

1. `PROJECT_CONSTITUTION.md`
2. `PROJECT_CONTEXT.md`
3. `BUSINESS_GLOSSARY.md`
4. `FOLDER_STRUCTURE.md`
5. This guide and satellite docs

# Stack

- Next.js App Router (TypeScript)
- Convex (auth, data, business rules)
- Tailwind CSS v4 + tokenized theme
- Dexie (IndexedDB) for local-first cache and outbox
- pnpm

# Scripts

```bash
pnpm install
pnpm dev:all          # Next + Convex
pnpm typecheck
pnpm lint
```

# Git

Work on `staging`. Open a PR into `main` only for a product release. Squash-merge
`staging` → `main` so production history stays one commit per release. GitHub
Actions then **merge-commits** that squash back into `staging`. Squash is what
keeps `main` clean; the sync is what prevents the next release PR from
conflicting. If the sync opens a PR, merge it with a merge commit (do not
squash the sync).

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
