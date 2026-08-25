Capacitor UI/UX Fix — Reset Scroll Position on Navigation

There is a scroll-position bug in the Capacitor mobile app.

For example:

User opens Sales.
User scrolls to the bottom.
User taps Inventory from the bottom navigation.
Inventory opens at the same scroll position instead of starting at the top.

The destination page should have its own independent scroll position and should start from the top when navigating to a different route.

Please inspect the existing routing/navigation and scroll-container architecture and fix the root cause rather than adding page-specific workarounds.

Requirements:

Navigating to a different route should reset the destination screen to the top.
This should work consistently across all Capacitor bottom-navigation routes.
It should also work when navigation occurs programmatically or through sidebar links where applicable.
Do not break intentional internal scrolling within a page.
Avoid resetting scroll repeatedly while the user is interacting with the same page.
Handle the actual scroll container used by the mobile application, not only window.scrollTo().
Preserve normal browser history/back-navigation behavior where appropriate.
Verify the fix across Sales, Inventory, Products, Orders, Returns, Customers, Reports, Settings, and other main routes.

The goal is:

Navigate to another screen → destination starts at the top → user can then scroll independently.
