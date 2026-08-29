# Product Tours

## Architecture

Product tours live under `features/tours/`. `tour-registry.ts` is the typed,
versioned catalog. Each tour declares:

- a stable ID and version;
- its owning route;
- role or platform-admin eligibility;
- stable `data-tour` anchors;
- concise, task-focused steps.

`ProductTourProvider` mounts after the authenticated shell and offline
providers are ready. Driver.js supplies keyboard-aware highlighting, progress,
Next, Back, Finish, and close behavior. Popovers use Novend design tokens.

## Eligibility

All existing and new authenticated users are eligible once for each tour
version. Tenant roles receive only tours for permitted features. The platform
tour requires Super Admin status. A version increase makes the updated tour
eligible again.

The shell tour starts on the first dashboard visit. Contextual tours start on
the first visit to Sales, Products, Inventory, Reports, Users, Settings, or the
platform console. Tours skip missing responsive anchors rather than blocking
work.

## Progress and offline behavior

Convex `userTourProgress` is the cross-device source of truth. The client
mirrors progress in local storage using the authenticated account ID. Offline
completion, skip, and resume changes are marked dirty and synchronized after
reconnection.

Tour state is user-owned. Public APIs derive the user and organization from the
authenticated session and never accept either identity from the client.

## Replay

Tenant users can replay available tours from Settings → Help & tours. Platform
admins can use Platform Help. Replay navigates to the tour's owning route,
resets progress, waits for anchors, and starts the selected tour.

## Adding a tour

1. Add stable, semantic `data-tour` anchors to existing controls.
2. Add a typed registry entry with role restrictions and a version.
3. Keep each step focused on a user outcome rather than UI decoration.
4. Verify desktop, mobile web, PWA, Electron, Capacitor, keyboard, and reduced
   viewport behavior.
5. Add eligibility and route-resolution tests.
