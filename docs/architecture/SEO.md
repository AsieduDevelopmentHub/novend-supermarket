# SEO and AEO

Public discovery for Novend’s marketing surface (landing, docs, legal, download,
auth entry links). Authenticated POS routes stay out of the index.

## Production hosts

| Role | Origin |
| ---- | ------ |
| Marketing / SEO | `https://www.novendpos.app` |
| POS / auth | `https://dashboard.novendpos.app` |
| Apex | `https://novendpos.app` → redirects to www |

## Surfaces

| Artifact | Path / module |
| -------- | ------------- |
| Sitemap | `/sitemap.xml` ← [`app/sitemap.ts`](../../app/sitemap.ts) |
| Robots | `/robots.txt` ← [`app/robots.ts`](../../app/robots.ts) |
| Shared helpers | [`lib/seo/`](../../lib/seo/) |
| AI / answer engines | [`public/llms.txt`](../../public/llms.txt) |
| JSON-LD | Landing (Organization, SoftwareApplication, WebSite, FAQPage); Help (FAQPage) |

## Canonical origin

Resolved by [`lib/seo/site-url.ts`](../../lib/seo/site-url.ts):

1. `NEXT_PUBLIC_MARKETING_URL` (when host-split)
2. else `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` / `NOVEND_APP_URL`
3. else production fallback `https://www.novendpos.app`

Set these on Vercel Production:

- `NEXT_PUBLIC_SITE_URL=https://www.novendpos.app`
- `NEXT_PUBLIC_MARKETING_URL=https://www.novendpos.app`
- `NEXT_PUBLIC_APP_URL=https://dashboard.novendpos.app`

Marketing CTAs for Sign in / Start free resolve to the app origin via
[`appEntryHref`](../../lib/hosting/hosts.ts).

## Indexed vs noindex

**Indexed:** `/`, `/download`, `/docs`, `/docs/help`, `/docs/releases`, `/pricing`,
`/product`, legal pages. Auth entry paths are linked to the dashboard host.

**Noindex / disallow:** authenticated shell (`app/(app)` metadata + robots
disallow list), `/platform`, `/billing/*`, password reset, onboarding, `/api/*`.

## Post-deploy checklist

1. Confirm marketing URL env vars match `https://www.novendpos.app`.
2. Confirm Convex `SITE_URL` is `https://dashboard.novendpos.app` (app, not www).
3. Open `/robots.txt` and `/sitemap.xml` on www.
4. From www, click Sign in / Start free — should land on `dashboard.novendpos.app`.
5. Spot-check landing view-source for `og:` tags and `application/ld+json`.

## Out of scope

Custom 1200×630 OG artwork, hreflang, blog content, and paid link campaigns.
