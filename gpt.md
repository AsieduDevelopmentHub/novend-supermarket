# gpt.md — resolved (login / route / dashboard)

## Fixed

1. **Stale `/platform` after Super Admin logout**
   - `clearLastRoute()` on sign-out
   - `resolvePostAuthPath` rejects `/platform` for non–platform-admins
   - `RestoreLastRoute` role-gates platform restores

2. **Dashboard zeros until refresh**
   - Bind org Dexie replica during post-login resolve (before navigate)
   - Bind during app layout render + remount `OfflineProvider` per org/user
   - Force first snapshot when replica has no `lastSnapshotAt`
   - Dashboard stays loading until replica hydrates (not empty zeros)

Acceptance path: login → authorized landing → local dashboard data → background sync.
