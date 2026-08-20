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
