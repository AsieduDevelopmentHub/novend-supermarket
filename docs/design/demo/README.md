# Novend marketing demo videos

Source / editing workspace for homepage product demos.

## Publish a chapter

1. Drop the finished master here (any working filename is fine).
2. Copy it to the public slug used by the site:

```text
public/marketing/demo/<chapter-id>.mp4
```

3. In `features/marketing/content.ts` → `landingCopy.demo.chapters`, set matching
   `id`, `src: "/marketing/demo/<chapter-id>.mp4"`, and `published: true`.

## Chapter ids

| id | Intent |
|----|--------|
| `overview` | Full product pass (live) |
| `guided` | Cursor-annotated walkthrough (live) |
| `login` | Sign-in / session resume |
| `signup` | Organization create |
| `onboarding` | First catalogue and first sale |
| `checkout` | Counter sell flow |
| `inventory` | Stock and transfers |
| `offline` | Offline sell + reconnect sync |

Unpublished chapters stay in content so tabs appear as soon as `published` flips
on — no component changes required.

## Current masters in this folder

- `novend-pos-live-demo.mp4` → published as `overview`
- `novend-pos-live-cursor.mp4` → published as `guided`
