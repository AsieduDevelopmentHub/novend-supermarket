# Novend POS

## Development Guide

Version: 1.0.1

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

Work on `staging`. Open a PR into `main` only for a product release. Merge
`staging` → `main` with a **merge commit** (not squash). Squash rewrites the
release commits and the next PR conflicts on version files. After `main`
updates, GitHub Actions merges `main` back into `staging`.

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
