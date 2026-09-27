# Novend marketing demo videos

Source / editing workspace for homepage teasers and the `/demo` training series.

## Homepage teasers (`/#demo`)

1. Drop the finished master here (any working filename is fine).
2. Copy it to the public slug used by the site:

```text
public/marketing/demo/<chapter-id>.mp4
```

3. In `features/marketing/content.ts` → `landingCopy.demo.chapters`, set matching
   `id`, `src: "/marketing/demo/<chapter-id>.mp4"`, and `published: true`.

### Chapter ids

| id | Intent |
|----|--------|
| `overview` | Complete training (merged series) — live |
| `guided` | Cursor-annotated walkthrough (live) |
| `login` | Sign-in / session resume |
| `signup` | Organization create |
| `onboarding` | First catalogue and first sale |
| `checkout` | Counter sell flow |
| `inventory` | Stock and transfers |
| `offline` | Offline sell + reconnect sync |

## Detail page (`/demo`)

**Main video:** `novend-pos-complete-training.mp4` →
`public/marketing/demo/complete-training.mp4` (`landingCopy.demoPage.full`).

**Per-action series:** masters in `novend-pos-training-series/`. Publish copies to:

```text
public/marketing/demo/training/<same-filename>.mp4
```

Video posters use the Novend brandmark (`/branding/brandmark.png`) — not the
old collage `novend-training-series-preview.jpg`.

Then add/update the episode in `landingCopy.demoPage.episodes`.
Deep links: `/demo#full`, `/demo#sales`, `/demo#account-setup`.

| order | file | episode id |
|------:|------|------------|
| 01 | `01-novend-account-setup.mp4` | `account-setup` |
| 02 | `02-novend-dashboard.mp4` | `dashboard` |
| 03 | `03-novend-products.mp4` | `products` |
| 04 | `04-novend-wholesale.mp4` | `wholesale` |
| 05 | `05-novend-inventory.mp4` | `inventory` |
| 06 | `06-novend-sales.mp4` | `sales` |
| 07 | `07-novend-orders.mp4` | `orders` |
| 08 | `08-novend-returns.mp4` | `returns` |
| 09 | `09-novend-customers.mp4` | `customers` |
| 10 | `10-novend-analytics.mp4` | `analytics` |
| 11 | `11-novend-reports.mp4` | `reports` |
| 12 | `12-novend-branches.mp4` | `branches` |
| 13 | `13-novend-users.mp4` | `users` |
| 14 | `14-novend-settings.mp4` | `settings` |

## Current homepage masters

- `novend-pos-complete-training.mp4` → published as homepage `overview` + `/demo` main
- `novend-pos-live-cursor.mp4` → published as `guided`
- `novend-pos-live-demo.mp4` — older short teaser (optional; superseded by complete training)
