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
Next, Back, Finish, Skip tour, and close behavior. Popovers use a solid Novend
card with a strong shadow so they stay readable over the overlay.

## Eligibility

All existing and new authenticated users are eligible once for each tour
version. Tenant roles receive only tours for permitted features. The platform
tour requires Super Admin status. A version increase makes the updated tour
eligible again.

## First-run onboarding

Users with no stored tour progress receive a single onboarding journey. The
provider redirects to the first eligible page, highlights its anchors, then
advances to the next page (scroll into view, then highlight) until the role's
queue is finished:

- Cashier: shell → sales → settings
- Manager / administrator: shell → sales → products → inventory → reports →
  users → settings
- Platform-only: platform

**Skip tour** (and the close control) skip the rest of that journey so the
operator is not trapped. Settings → Help & tours Start/Replay runs one tour
only and does not chain pages.

After onboarding, contextual tours still start on the first visit to a page
the user has not completed or skipped.

## Anchors and mobile

`resolveStepAnchor` picks the first **visible** match. Hidden desktop sidebar
nodes (`hidden lg:block`) are ignored so Capacitor uses the bottom tabs and
mobile web uses the header hamburger. Account and sync steps fall back to
`data-tour="mobile-more"` and the compact header sync control when the sidebar
is not on screen. Missing responsive anchors are skipped rather than blocking
work.

## Progress and offline behavior

Convex `userTourProgress` is the indexed, user-owned history. Each save also
writes a compact copy onto `profiles.tourProgress` so `users.me` and the offline
snapshot can hydrate a new device without a second round-trip.

The client mirrors that array in IndexedDB (`meta.tourProgress`). Offline skip,
complete, and resume rows are marked dirty and synchronized after reconnect.
Legacy `localStorage` keys (`novend.tours.v1:*`) are migrated once into Dexie
and then removed.

Tour state is user-owned. Public APIs derive the user and organization from the
authenticated session and never accept either identity from the client. First-run
onboarding waits until IndexedDB (and the profile payload, when online) has
hydrated so a completed tour is not shown again.

## Replay

Tenant users can replay available tours from Settings → Help & tours. Platform
admins can use Platform Help. Replay navigates to the tour's owning route,
resets progress, waits for anchors, and starts the selected tour without
continuing the first-run chain.

## Adding a tour

1. Add stable, semantic `data-tour` anchors to existing controls.
2. Add a typed registry entry with role restrictions and a version.
3. Keep each step focused on a user outcome rather than UI decoration.
4. If the tour belongs in first-run onboarding, add its id to
   `ONBOARDING_TOUR_ORDER`.
5. Verify desktop, mobile web, PWA, Electron, Capacitor, keyboard, and reduced
   viewport behavior.
6. Add eligibility, route-resolution, and visible-anchor tests.
