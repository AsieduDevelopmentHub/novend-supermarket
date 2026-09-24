# SEO and AEO

Public discovery for Novend’s marketing surface (landing, docs, legal, download,
auth entry). Authenticated POS routes stay out of the index.

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
3. else production fallback `https://novend-pos.vercel.app`

Set the public HTTPS origin on Vercel (and Convex-independent Next env) so Open
Graph URLs and sitemap entries are absolute and correct.

## Indexed vs noindex

**Indexed:** `/`, `/download`, `/docs`, `/docs/help`, `/docs/releases`, legal
pages, `/login`, `/signup`.

**Noindex / disallow:** authenticated shell (`app/(app)` metadata + robots
disallow list), `/platform`, `/billing/*`, password reset, onboarding, `/api/*`.

## Post-deploy checklist

1. Confirm `NEXT_PUBLIC_SITE_URL` (or marketing URL) is the live HTTPS origin.
2. Open `/robots.txt` and `/sitemap.xml` on production.
3. Submit the sitemap in Google Search Console and Bing Webmaster Tools.
4. Spot-check landing view-source for `og:` tags and `application/ld+json`.
5. Optional: verify FAQ rich-result eligibility in Google’s Rich Results Test.

## Out of scope

Custom 1200×630 OG artwork, hreflang, blog content, and paid link campaigns.
