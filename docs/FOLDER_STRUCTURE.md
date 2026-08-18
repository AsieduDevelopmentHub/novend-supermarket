# Novend POS

## Repository Structure

Version: 1.0.0

# Philosophy

Feature-first modular architecture. A developer should know where new code belongs
by reading the tree.

This slice uses a Princellen-shaped single app, **not** `apps/web` + `packages/*`.
Extract packages when a second consumer exists.

```text
novend-pos/
├── app/                 # Next.js routes, layouts, metadata
├── features/            # Feature UI, hooks, types
├── components/          # Shared, business-agnostic UI
├── convex/              # Schema, queries, mutations, auth
├── lib/                 # Shared non-React utilities (including offline)
├── hooks/               # Shared generic React hooks
├── types/               # Shared TypeScript types
├── services/            # Print and other integrations
├── providers/           # App-wide providers
├── config/              # Navigation and app config
├── constants/           # Immutable shared constants
├── styles/              # Global tokens
├── public/              # Static assets, service worker
├── docs/                # Project documentation
├── .cursor/             # AI rules
└── overview.md          # Product vision
```

# Ownership

| Location | Owns |
|----------|------|
| `app/` | Routes, layouts, metadata, page assembly |
| `features/` | Feature UI and presentation logic |
| `components/` | Shared UI — never Convex, never business rules |
| `convex/` | Schema, auth, authorization, validation, integrity |
| `lib/` | Shared non-React utilities |
| `hooks/` | Shared generic React hooks |
| `providers/` | App-wide providers only |
| `docs/` | Project documentation |
| `.cursor/` | Concise AI rules that reference docs |

# Placement rules

- Feature-specific code stays in `features/<feature>/`.
- Business rules stay in `convex/`.
- Do not create `misc`, `temp`, `new`, or `old` folders.
- When adding a top-level folder, update this document in the same change.

# Import direction

```text
app → features → components → hooks → lib → convex
```

No circular imports. `components/` never import from `features/` or call Convex.
