Capacitor Bottom Navigation Refinement

The current bottom navigation design is good, but I want to refine the active-state interaction and visibility.

Keep the existing round/circular active CTA with the candy-blue glow.
When a navigation item becomes active, animate the circle slightly upward, creating a floating tooltip/notch effect above the navigation bar.
The navigation bar should visually have a cut-out/gap around the active circle, so there is visible empty space between the circle and the bar.
The active circle should appear as though it is floating out of the navigation bar, rather than simply sitting inside it.
Add a subtle, smooth elevation/glow/depth effect while keeping the animation professional and minimal.
Keep the navigation bar's existing curved shape and safe-area behavior.

Also, the navigation labels are currently too faint/invisible. Increase their brightness/contrast slightly so they are clearly readable while remaining consistent with the Novend color system.

Desired interaction
          ◉  ← active item floats upward
───────╯     ╰───────  ← visible cut/gap around active item
│   Home   Sales   Inventory   │
╰──────────────────────────────╯

Do not change navigation routes or functionality. This is strictly a Capacitor bottom-navigation visual/interaction refinement.