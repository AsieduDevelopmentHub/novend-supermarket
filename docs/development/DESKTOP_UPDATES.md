# Desktop updates via Convex

Packaged Novend POS apps discover updates through Convex, not the GitHub Releases API. GitHub still stores the installer binaries (private repo). Convex holds metadata and redirects downloads with a short-lived GitHub asset URL.

```
Tag v* → GitHub Actions builds + uploads installers
      → publish job posts metadata to Convex
      → app / Settings / Super Admin download via
        {CONVEX_SITE_URL}/desktop-updates/...
```

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
```

`CONVEX_SITE_URL` is provided by Convex. Bake it into installers with GitHub secret `CONVEX_SITE_URL`.

## GitHub Actions secrets

- `CONVEX_SITE_URL`
- `DESKTOP_RELEASE_PUBLISH_SECRET` (same value as Convex)
- `NOVEND_APP_URL` (hosted web app loaded by Electron)

## Manual republish of an existing tag

```bash
pnpm desktop:publish-convex
```

Requires `CONVEX_SITE_URL`, `DESKTOP_RELEASE_PUBLISH_SECRET`, `GH_TOKEN`, and `RELEASE_TAG`.
