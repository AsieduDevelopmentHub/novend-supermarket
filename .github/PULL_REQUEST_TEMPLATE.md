## Summary

<!-- What changed and why. -->

## Test plan

<!-- How to verify. -->

## Merge (staging → main)

Use **Create a merge commit**, not squash or rebase. Squash-merging `staging` into `main` rewrites history and the next release PR conflicts on version files (`package.json`, `CHANGELOG.md`). After `main` updates, `Sync staging from main` merges `main` back into `staging`.
