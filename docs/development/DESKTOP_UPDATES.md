# Desktop updates via Convex

Packaged Novend POS apps discover updates through Convex, not the GitHub Releases API. GitHub still stores the installer binaries (private repo). Convex holds metadata and redirects downloads with a short-lived GitHub asset URL.

```
Tag v* → GitHub Actions (desktop installers only when targets is all)
      → publish job posts metadata to Convex
      → app / Settings / Super Admin download via
        {CONVEX_SITE_URL}/desktop-updates/...
```

## Download monitoring

Desktop update checks and asset redirects record privacy-limited platform events
before returning the manifest or GitHub redirect. Events contain only release
version, classified asset type, source category, count, and timestamp. A
telemetry failure never blocks an update. Existing GitHub download totals can
be imported once from Platform Exports as the historical baseline.

## Convex environment

Generate the shared publish secret:

```bash
pnpm desktop:secret
```

Prints a value. To write it into Convex and/or GitHub:

```bash
pnpm desktop:secret -- --set-convex
pnpm desktop:secret -- --set-github
pnpm desktop:secret -- --set-convex --set-github
```

Then set the GitHub PAT Convex uses to mint private asset downloads:

```bash
npx convex env set DESKTOP_RELEASE_GITHUB_TOKEN <github-pat-with-repo-read>
pnpm desktop:verify-github-token -- --tag v0.1.3
```

**Critical:** `DESKTOP_RELEASE_GITHUB_TOKEN` must be able to read **private** GitHub
Release assets for `AsieduDevelopmentHub/novend-pos`. CI’s ephemeral `GITHUB_TOKEN`
is not stored in Convex — downloads fail with Cloudflare 502 when this PAT is missing
or lacks repository access.

Use either:

- **Classic PAT** — `repo` scope (simplest), or
- **Fine-grained PAT** — repository access to `novend-pos`, **Contents: Read**

Symptoms of a bad token: Settings → Download returns 502; Convex asset URLs return
`GitHub rejected DESKTOP_RELEASE_GITHUB_TOKEN` after deploy.

Installers stay on **GitHub Releases**; Convex only stores metadata and issues a
302 redirect to GitHub’s CDN. Do not upload `.exe` files to Convex file storage.

`CONVEX_SITE_URL` is provided by Convex (`*.convex.site`). Bake it into installers
with GitHub secret `CONVEX_SITE_URL`. The hostname (e.g. `lovable-kangaroo-386`) is
correct when it matches your active Convex deployment — not hardcoded in source.

The hosted web origin is baked into the same `update-config.json` as `appUrl`.
Default is `https://novend-pos.vercel.app`. Optional GitHub secret `NOVEND_APP_URL`
overrides that at **package** time. It is not read from the cashier’s environment.

## GitHub Actions secrets

- `CONVEX_SITE_URL` — required for auto-update metadata
- `DESKTOP_RELEASE_PUBLISH_SECRET` (same value as Convex)
- `NOVEND_APP_URL` — optional; defaults to `https://novend-pos.vercel.app` if unset

## Manual republish of an existing tag

```bash
pnpm desktop:publish-convex
```

Requires `CONVEX_SITE_URL`, `DESKTOP_RELEASE_PUBLISH_SECRET`, `GH_TOKEN`, and `RELEASE_TAG`.

## GitHub Release title and notes

electron-builder often creates the GitHub Release with a bare version title and an empty body. After installer assets land, `scripts/sync-github-release-notes.mjs` rewrites:

- **Title:** `Novend POS vX.Y.Z`
- **Body:** the matching `CHANGELOG.md` section

Add a `## vX.Y.Z` (or `## X.Y.Z`) heading before tagging. The desktop workflow fails the notes step if that section is missing.

Tag pushes default to Android APK + Convex mobile only. Desktop installers and desktop Convex metadata require workflow_dispatch with `targets: all`.

Mobile APK publishing uses the same workflow — see `docs/development/MOBILE_UPDATES.md`.
