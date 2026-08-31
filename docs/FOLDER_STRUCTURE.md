# Novend POS

## Repository Structure

Version: 1.1.2

# Philosophy

Feature-first modular architecture. A developer should know where new code belongs
by reading the tree.

This slice uses a Princellen-shaped app root plus thin native shells.
`packages/hardware` exists because Capacitor is a second consumer of shared
hardware APIs. Do not extract further packages until another consumer requires it.

```text
novend-pos/
├── app/                 # Next.js routes, layouts, metadata
├── features/            # Feature UI, hooks, types (incl. marketing, more)
├── components/          # Shared, business-agnostic UI
├── convex/              # Schema, queries, mutations, auth
├── lib/                 # Shared non-React utilities (including offline, import, export)
├── hooks/               # Shared generic React hooks
├── types/               # Shared TypeScript types
├── services/            # Print, hardware helpers, other integrations
├── providers/           # App-wide providers
├── config/              # Navigation (desktop + mobile tabs) and app config
├── constants/           # Immutable shared constants
├── styles/              # Global tokens
├── public/              # Static assets, service worker
├── packages/hardware/   # Cross-platform hardware abstraction (@novend/hardware)
├── apps/desktop/        # Electron shell (loads the hosted Next app)
├── apps/mobile/         # Capacitor shell (loads the hosted Next app)
├── docs/                # Project documentation
├── .cursor/             # AI rules
└── overview.md          # Product vision
```

# Ownership

| Location             | Owns                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `app/`               | Routes, layouts, metadata, page assembly                                                                                     |
| `features/`          | Feature UI and presentation logic (including `features/marketing`, `features/more`)                                          |
| `components/`        | Shared UI — never Convex, never business rules                                                                               |
| `convex/`            | Schema, auth, authorization, validation, integrity                                                                           |
| `lib/`               | Shared non-React utilities (offline replica, `lib/import`, `lib/export`)                                                     |
| `hooks/`             | Shared generic React hooks                                                                                                   |
| `providers/`         | App-wide providers only                                                                                                      |
| `config/`            | Desktop nav groups + Capacitor bottom tabs (`mobile-navigation.ts`)                                                          |
| `docs/`              | Project documentation                                                                                                        |
| `.cursor/`           | Concise AI rules that reference docs                                                                                         |
| `packages/hardware/` | Sole entry for camera, barcode, printer, BLE, biometrics, filesystem, share, notifications, app services; platform detection |
| `apps/desktop/`      | Electron wrapper, installers, desktop CI. Bakes `appUrl` + Convex update feed into `build/update-config.json`.               |
| `apps/mobile/`       | Capacitor Android shell (published). An iOS tree exists but is not the customer client — iOS uses the Home Screen PWA.       |

# Placement rules

- Feature-specific code stays in `features/<feature>/`.
- `features/tours/` owns the versioned product-tour registry, access filtering,
  responsive anchor resolution, and the authenticated tour provider. Progress is
  mirrored in Dexie (`lib/offline/tour-progress-cache.ts`) and on the Convex
  profile plus `userTourProgress`.
- Business rules stay in `convex/`.
- Do not create `misc`, `temp`, `new`, or `old` folders.
- When adding a top-level folder, update this document in the same change.

# Import direction

```text
app → features → components → hooks → lib → convex
```

No circular imports. `components/` never import from `features/` or call Convex.
