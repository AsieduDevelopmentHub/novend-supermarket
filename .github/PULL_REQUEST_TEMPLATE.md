## Summary

<!-- What changed and why. -->

## Test plan

<!-- How to verify. -->

## Release merge (`staging` → `main`)

Squash is the default and is what we want on `main` (one commit per release). After that lands, **Sync staging from main** merges that squash commit back into `staging` so the next release does not fight the last one. Do not skip that sync. If the sync opens a PR, merge it with a merge commit (do not squash the sync).
