Before we move on to P1, I want us to add a first-time user onboarding/tour experience, similar to what you see in polished SaaS products.

When a user enters Novend for the first time, they should be guided through the main parts of the system with an interactive walkthrough. It should highlight important navigation items, dashboards, key actions, and core workflows so a new user understands how to use the system.

The tour should:

Automatically appear for first-time users.
Highlight the relevant UI element with a clear tooltip/popover.
Explain what each feature does in simple, user-friendly language.
Allow Next / Back / Skip Tour controls.
Allow users to exit the tour at any point.
Remember the user's progress/completion so it doesn't repeatedly appear.
Provide an option to Restart/Replay the tour later from Settings or Help.
Work consistently across Web, PWA, Electron, and Capacitor mobile.
Be responsive and adapt the walkthrough to desktop vs. mobile layouts.
Avoid blocking normal application usage unnecessarily.
Respect the user's organization/role so users only see tours for features they can actually access.

Also include contextual onboarding for important workflows where appropriate, rather than trying to explain the entire system in one huge tour.

Before implementation, inspect the existing UI/navigation architecture and design a reusable onboarding/tour system that can later support additional tours and feature announcements without rebuilding the component from scratch.

## Implemented architecture

The onboarding system is implemented with a versioned, role-aware Driver.js
registry under `features/tours/`. Progress is persisted per authenticated user
in Convex and mirrored locally so completion, skip, and resume continue to work
offline. The shell and contextual tours use stable responsive anchors and skip
controls that are not present on the current surface.

Available contextual tours cover the shell, Sales, Products, Inventory,
Reports, Users, Settings, and the Super Admin platform console. Tenant users
can replay eligible tours from Settings → Help & tours; platform-only admins
can replay the platform tour from Platform Help.

See `docs/architecture/PRODUCT_TOURS.md` for ownership, extension, privacy, and
offline behavior.