# Push notifications

Novend delivers operational alerts (stock, transfers, subscription) through a
single Convex dispatch path to platform-specific endpoints.

## Channels

| Platform | Delivery | Registration |
| -------- | -------- | ------------ |
| Web / PWA | Web Push (VAPID) via `web-push` in a Convex Node action | Service worker + `PushManager.subscribe` |
| Capacitor | FCM HTTP v1 (token stored on `pushDevices`) | `@capacitor/push-notifications` |
| Electron | Foreground only — `pushOutbox` rows → desktop `Notification` IPC | Stable `electron:` device key |

Background Electron push while the app is quit is out of scope.

## Secrets

Generate VAPID keys:

```bash
pnpm push:vapid
# or: node scripts/generate-vapid-keys.mjs
```

Set on the Convex deployment (private):

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` — e.g. `mailto:support@yourdomain.com`

Expose the **public** key to the client:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (`.env.local` / Vercel)

For Capacitor remote delivery, set Convex:

- `FCM_SERVICE_ACCOUNT_JSON` — full Firebase service-account JSON (one line).
  Without it, Cap tokens still register; FCM send is skipped.

Android also needs `google-services.json` in the Cap project and APNs setup for
iOS. Do not commit private VAPID or FCM credentials.

## Data model

- `pushDevices` — org + user scoped endpoints and topic prefs
- `pushOutbox` — short-lived Electron foreground payloads

Mutations: `registerDevice`, `unregisterDevice`, `updateTopicPrefs`, outbox
`listMyOutbox` / `ackOutbox`. Dispatch: `internal.pushDispatch.dispatchPush`.

The same dispatch also writes `appNotifications` for the in-app bell
(`api.appNotifications.mine`). Device topics and VAPID / FCM / Electron
delivery are unchanged. A missing inbox write does not stop the push.

Mute (`profiles.notificationsMuted`) holds both the inbox and device delivery
for that person. Existing devices without the field stay unmuted.

## In-app inbox

Bell in the POS header (phone and desktop) and the desktop sidebar.

- Mark all read, clear all, mute
- Topics: stock, transfers, daily summary, subscription, cashier clock-in
- Cashiers see stock and transfers. Administrators see billing. Managers and
  administrators see clock-in. Completed sales are not notifications.

`staff_clock_in` and `platform_notice` exist only on the inbox. They are not
device topics, so older `pushDevices` rows stay valid.

Platform owners and operators can compose a notice at `/platform/notifications`.
It uses the same audiences as platform SMS: business owners, administrators,
and managers. Cashiers are excluded. A person who muted notifications does not
receive it. The notice appears in the bell; it does not send SMS or device push.

## Triggers (this slice)

- Daily cron `push alert digests` (`internal.pushDispatch.runDailyAlertDigests`)
  — low stock / expiry + trial/subscription reminders
- `inventory.transferStock` — `branch_transfers` topic

Topic prefs gate every send.
