You are working on Novend POS. Inspect the existing repository, architecture, database schema, offline storage, synchronization system, feature flags, routes and shared UI components before implementing anything.

Do not rewrite the application or introduce a second offline architecture. Extend the existing patterns and preserve all working Retail, Pharmacy, Supermarket and Wholesale functionality.

## Objective

Improve the Restaurant, Bar and Hotel business profiles so they behave like complete, business-oriented workflows rather than additional pages attached to a retail POS.

The implementation must be offline-first, searchable, responsive, owner-friendly and consistent across modules.

## Live-system findings to address

1. Held sales appear below the complete product catalogue. With a large catalogue, the cashier must scroll excessively to find them.
2. Restaurant and Bar currently share generic `Floor` and `Kitchen` labels and almost identical flows.
3. Table checks, kitchen/bar tickets, hotel folios and reservations do not appear in the Orders area while they are operational.
4. Orders currently represents completed sales only.
5. The Hotel dashboard remains a generic retail dashboard and does not show hotel operations.
6. Hotel POS copy still says “Create a new wholesale or retail sale.”
7. A reservation can be confirmed for an occupied room with overlapping dates.
8. Product, customer, guest, room, branch and other selectors are inconsistent. Several dropdowns have no search field.
9. Non-stock products still show an `In stock` status, and Products always displays Stock and Status columns.
10. Floor, room, reservation and related operational pages or records become unavailable offline.
11. Applying an industry pack changes navigation before settings are saved.
12. Applying a pack can reset brand colours.
13. Business terminology is hardcoded instead of being based on the selected business profile.

## 1. Reposition held sales

Remove the Held Sales section from beneath the product grid.

Add a permanently visible Held Sales action near the `Current Sale` heading or main POS toolbar:

- Use an appropriate hold/clock icon.
- Show a badge containing the number of held sales.
- Keep it visible without scrolling.
- On desktop, open a side panel or modal.
- On mobile, use a full-width sheet or similarly accessible interface.
- List the reference, customer if available, total, time, device/sync state and Resume action.
- Sort newest first.
- Restoring a held sale must safely replace or merge with the current cart only after an explicit user decision.
- Keep keyboard navigation, focus management and screen-reader labels accessible.

## 2. Introduce a unified operational-order model

Do not incorrectly treat every operational action as a completed sale. Create a unified operational model that connects business workflows to the final sale.

Support source types such as:

- `pos`
- `restaurant_table`
- `bar_tab`
- `room_folio`
- `reservation`

Support separate lifecycle fields such as:

- Operational status
- Fulfilment status
- Payment status
- Sync status

An open table check, bar tab or hotel folio should be visible to the owner before payment. When it is settled, atomically create or link the completed sale without duplicating stock deductions or revenue.

Update Orders with clear views such as:

- All activity
- Open operations
- Completed sales

Allow filtering by branch, source, status, payment state, employee and date.

Each record should show its origin, for example Table 4, Bar Tab 8, Room 101, Reservation or Direct POS.

## 3. Restaurant workflow

Implement a business-oriented flow:

`Table → Open check → Add menu items/modifiers → Send ticket → Preparing → Ready → Served → Payment → Completed sale`

Requirements:

- One active check per table unless split-check support already exists.
- Make tables easy to group by floor or service area.
- Show open-check total, elapsed time, server/cashier and fulfilment state.
- Allow kitchen tickets to update the originating check.
- The owner dashboard should show occupied tables, open checks, pending kitchen tickets, ready tickets and sales.
- Use Restaurant-specific wording instead of generic retail wording.

## 4. Bar workflow

The Bar profile must not look like a renamed restaurant module.

Use terminology and workflow appropriate to bars:

`Table or customer tab → Add drinks/items → Send to bar → Preparing → Ready/Served → Settle tab`

Requirements:

- Rename `Kitchen` to `Bar queue` or a configurable equivalent by default.
- Use `Tab` instead of `Check` where appropriate.
- Support both seated tables and customer tabs.
- Preserve optional kitchen routing for businesses that also serve food.
- Show open tabs, unserved items, outstanding balances and completed sales to the owner.

## 5. Hotel workflow

Create a connected hotel lifecycle:

`Reservation → Arrival → Check-in → Occupied room → Folio charges → Checkout → Completed sale → Room dirty/cleaning → Available`

The owner-facing dashboard should include:

- Available, reserved, occupied, dirty and maintenance rooms
- Arrivals and departures
- Current guests
- Active folios
- Outstanding folio balances
- Reservation status
- Hotel revenue and completed sales

Add proper reservation conflict validation:

- Prevent overlapping confirmed or checked-in reservations for the same room.
- Validate both locally and on the server.
- Recheck conflicts during synchronization.
- Exclude cancelled, no-show and checked-out records according to the existing business rules.
- Present a clear conflict message and suggest available rooms.
- Never allow an occupied room to be assigned for an overlapping stay without an explicit override permission and audit record.

Folio charges, room nights, products and services must remain connected to the guest, stay, room, branch and eventual completed sale.

## 6. Offline-first support

Make all operational modules available after initial synchronization:

- Floors and service areas
- Tables
- Open checks and check lines
- Kitchen/bar tickets
- Rooms and room states
- Reservations
- Stays and check-ins
- Folios and folio charges
- Business profile and terminology configuration

Extend the current local database and outbox/sync mechanism.

Requirements:

- Render routes from local data first.
- Permit authorised create/update/status actions offline.
- Generate collision-safe client IDs.
- Store mutations in the existing outbox.
- Make synchronization idempotent.
- Preserve timestamps, actor, device, branch and version metadata.
- Handle conflicts for room reservations, room occupancy and active table checks.
- Show Pending Sync, Synced or Conflict states clearly.
- Never imply that another device or the owner has the latest information while disconnected.
- Do not hide pages offline because the business-profile configuration was not cached.

## 7. Standard searchable dropdown component

Create or improve one reusable `SearchableSelect` component and migrate entity selectors to it.

Every non-trivial dropdown must show a search input at the top, including:

- Products and menu items
- Customers, guests and patrons
- Rooms
- Tables
- Branches
- Suppliers
- Categories
- Nightly-rate products
- Folio charge products
- Reservation customer and room selectors

Requirements:

- Keyboard navigation
- Accessible roles and labels
- Clear selection
- Empty, loading and no-results states
- Local filtering while offline
- Debounced remote search when required
- Virtualisation or pagination for large lists
- A mobile-friendly sheet when space is limited

Reuse the searchable pattern already present in the product-category selector where practical.

## 8. Inventory and status visibility

Separate product availability from inventory tracking.

When `tracksInventory === false`:

- Do not show `In stock`, `Low stock`, expiry or quantity-based status.
- Hide irrelevant Stock and Status fields in product forms and operational views.
- Display `Non-stock item`, `Menu item`, `Service` or the configured business term where useful.

Show expiry information only when:

- The individual product has expiry tracking enabled; or
- The business has expiry tracking enabled and the product participates in it.

If only some products use expiry tracking, expiry dashboard cards and filters must calculate results from those products only.

Do not remove active/inactive catalogue status if that is a separate concept. Rename columns so catalogue state and stock state are never confused.

## 9. Business-specific terminology

Create a central terminology configuration instead of hardcoded labels.

Provide sensible defaults:

- Retail: Product, Customer, Sale, Order, Branch
- Restaurant: Menu item, Guest, Check, Kitchen ticket, Table
- Bar: Drink/Item, Patron, Tab, Bar ticket, Table
- Hotel: Service/Room rate, Guest, Folio, Reservation, Property

Allow administrators to override supported labels in Business Settings.

Apply terminology consistently to:

- Navigation
- Page headings
- Buttons
- Forms
- Empty states
- Dashboard cards
- Orders
- Receipts
- Reports
- Help text

Use a central helper or provider such as `businessTerms.get(key)` rather than scattered conditional strings.

## 10. Business-profile settings behavior

Make profile changes predictable and atomic:

- Selecting a profile should preview proposed defaults without immediately changing navigation.
- Apply the profile and its feature configuration only after Save.
- Clearly show which existing options will change.
- Preserve custom brand colours, logos, receipt settings and unrelated configuration.
- Do not reset branding unless the administrator explicitly requests it.
- Preserve existing operational records when switching profiles.
- Display a warning when disabling a feature that still has active checks, rooms, reservations or folios.

## 11. Responsive owner and staff experience

The owner should see the state of the business, while staff should see the actions relevant to their role.

- Owners/managers: operational summaries, exceptions, balances and drill-down views.
- Cashiers: quick sale and payment actions.
- Servers/bar staff: checks, tabs and fulfilment state.
- Kitchen/bar staff: focused ticket queue.
- Front desk: reservations, arrivals, rooms, folios and checkout.

Use existing permissions and do not expose restricted financial information to unauthorised roles.

## 12. Testing and acceptance criteria

Add unit, integration and end-to-end tests covering:

1. Held Sales is accessible without scrolling on desktop and mobile.
2. The badge count updates after hold, resume and synchronization.
3. Restaurant checks appear in Open Operations before payment.
4. Kitchen status changes update the originating check.
5. Bar navigation and wording use bar terminology.
6. Hotel folio activity appears in Open Operations before checkout.
7. Checkout produces one completed sale without duplicate stock or revenue.
8. An overlapping reservation for an occupied/reserved room is rejected.
9. Operational pages load from cached local data offline.
10. Offline actions synchronize exactly once after reconnection.
11. All migrated selectors contain a searchable input.
12. Non-stock products do not show misleading stock statuses.
13. Expiry information appears only for expiry-tracked products.
14. Business label overrides update all supported UI surfaces.
15. Unsaved profile changes do not modify navigation.
16. Switching profiles does not reset branding.
17. Existing Retail, Pharmacy, Supermarket and Wholesale tests continue to pass.

Start by documenting the existing flow and affected files. Then implement the work in small, reviewable phases with migrations and backward compatibility. Run the complete test, type-check, lint and production-build suites before reporting completion.

In the final report, include:

- Root causes found
- Schema and migration changes
- Screens and components changed
- Offline/sync behavior
- Tests added
- Any remaining limitations