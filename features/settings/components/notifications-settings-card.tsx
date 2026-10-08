"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Hardware,
  hasNovendNativeSecurity,
  isCapacitor,
  isElectron,
  permissionDeniedMessage,
  permissionNeedMessage,
  type NotificationPermissionState,
  type NotificationTopic,
} from "@novend/hardware";
import { api } from "@/convex/_generated/api";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useConnectivity } from "@/hooks/use-connectivity";

const TOPICS: Array<{ id: NotificationTopic; label: string; description: string }> = [
  {
    id: "stock_alerts",
    label: "Stock alerts",
    description: "Low stock and expiry reminders",
  },
  {
    id: "daily_summary",
    label: "Daily summary",
    description: "End-of-day sales report. Administrators get it in the app and by SMS. Turn this on to alert this device too.",
  },
  {
    id: "branch_transfers",
    label: "Branch transfers",
    description: "Incoming and completed stock transfers",
  },
  {
    id: "subscription_alerts",
    label: "Subscription alerts",
    description: "Plan limits and renewal reminders",
  },
];

const EMPTY_PREFS: Record<NotificationTopic, boolean> = {
  stock_alerts: false,
  daily_summary: false,
  branch_transfers: false,
  subscription_alerts: false,
};

function notificationsDescription(): string {
  if (isCapacitor()) {
    return "Choose which alerts to receive on this device.";
  }
  if (isElectron()) {
    return "Alerts appear while the desktop app is open.";
  }
  return "Browser push alerts for stock, transfers, and billing.";
}

/**
 * Cross-platform notification prefs + remote push registration.
 * Permission UX: Cap opens system settings; web/Electron use Notification.requestPermission.
 */
export function NotificationsSettingsCard() {
  const online = useConnectivity();
  const registerDevice = useMutation(api.pushNotifications.registerDevice);
  const updateTopicPrefs = useMutation(api.pushNotifications.updateTopicPrefs);
  const unregisterDevice = useMutation(api.pushNotifications.unregisterDevice);

  const [state, setState] = useState<NotificationPermissionState>("not-requested");
  const [prefs, setPrefs] = useState<Record<NotificationTopic, boolean>>(EMPTY_PREFS);
  const [permissionKnown, setPermissionKnown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pushReady, setPushReady] = useState(false);

  const refreshPermission = useCallback(async () => {
    setChecking(true);
    setErrorMessage(null);
    try {
      const permission = await Hardware.notifications.checkPermissions();
      setState(permission.data?.state ?? (permission.data?.granted ? "granted" : "not-requested"));
      setErrorMessage(permission.ok ? null : permission.message || null);
      setPermissionKnown(true);
    } catch {
      setState("error");
      setErrorMessage("Could not check notification permission.");
      setPermissionKnown(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const topics = await Hardware.notifications.getTopicPrefs();
        if (cancelled) return;
        if (topics.data) setPrefs(topics.data);
      } catch {
        /* prefs are best-effort */
      }
      if (!cancelled) await refreshPermission();
    })();
    const onVisible = () => {
      if (document.visibilityState === "visible" && hasNovendNativeSecurity()) {
        void refreshPermission();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshPermission]);

  async function syncRemoteRegistration(nextPrefs: Record<NotificationTopic, boolean>) {
    if (!online) return;
    const remote = await Hardware.notifications.registerRemote({
      vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });
    if (!remote.ok || !remote.data) {
      throw new Error(remote.message || "Could not register for push alerts.");
    }
    await registerDevice({
      platform: remote.data.platform,
      endpoint: remote.data.endpoint,
      p256dh: remote.data.p256dh,
      auth: remote.data.auth,
      topics: nextPrefs,
      userAgent: remote.data.userAgent,
    });
    setPushReady(true);
  }

  async function enableNotifications() {
    setBusy(true);
    try {
      const result = await Hardware.notifications.requestPermissions();
      const next = result.data?.state ?? (result.data?.granted ? "granted" : "denied");
      setState(next);
      setPermissionKnown(true);
      setErrorMessage(result.ok ? null : result.message || null);
      if (!result.ok) {
        toast.error(result.message || "Could not enable notifications.");
        return false;
      }
      if (next === "granted") {
        try {
          const topics = (await Hardware.notifications.getTopicPrefs()).data ?? prefs;
          await syncRemoteRegistration(topics);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not register for push.");
          return false;
        }
      } else if (isCapacitor()) {
        /* Settings opened — user returns after enabling. */
      }
      return next === "granted";
    } finally {
      setBusy(false);
    }
  }

  async function openSettings() {
    const result = await Hardware.app.openAppSettings();
    if (!result.ok) {
      toast.error(result.message || "Open system settings to allow notifications.");
    }
  }

  async function toggleTopic(id: NotificationTopic, enabled: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (!permissionKnown) await refreshPermission();
      if (state !== "granted" && enabled) {
        const current = permissionKnown ? state : "not-requested";
        if (current === "permanently-denied") {
          toast.error(permissionDeniedMessage("notifications"));
          if (isCapacitor()) await openSettings();
          return;
        }
        if (current === "unavailable") {
          toast.error("Notifications are unavailable on this device.");
          return;
        }
        const ok = await enableNotifications();
        if (!ok) return;
      }

      await Hardware.notifications.setTopicPrefs({ [id]: enabled });
      const topics = (await Hardware.notifications.getTopicPrefs()).data ?? {
        ...prefs,
        [id]: enabled,
      };
      setPrefs(topics);

      if (online && state === "granted") {
        try {
          await updateTopicPrefs({ topics });
          if (!pushReady) await syncRemoteRegistration(topics);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not save notification prefs.");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    try {
      const remote = await Hardware.notifications.unregisterRemote();
      if (remote.data?.endpoint && online) {
        await unregisterDevice({ endpoint: remote.data.endpoint });
      }
      setPushReady(false);
      setState("not-requested");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disable notifications.");
    } finally {
      setBusy(false);
    }
  }

  const granted = permissionKnown && state === "granted";
  const topicsDisabled =
    busy ||
    checking ||
    (permissionKnown && (state === "unavailable" || state === "permanently-denied"));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Notifications
        </CardTitle>
        <CardDescription>{notificationsDescription()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!permissionKnown && !checking ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              {permissionNeedMessage("notifications")}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void refreshPermission()}
            >
              Check notification permission
            </Button>
          </div>
        ) : null}

        {checking ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Checking notification permission…
          </p>
        ) : null}

        {permissionKnown && (state === "prompt" || state === "not-requested") ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              {permissionNeedMessage("notifications")}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void enableNotifications()}
            >
              Enable notifications
            </Button>
          </div>
        ) : null}

        {permissionKnown && state === "denied" ? (
          <div className="space-y-2">
            <p className="text-sm">{permissionDeniedMessage("notifications")}</p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void enableNotifications()}
            >
              Enable notifications
            </Button>
          </div>
        ) : null}

        {permissionKnown && state === "permanently-denied" ? (
          <div className="space-y-2">
            <p className="text-sm">Notifications are blocked for Novend on this device.</p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void openSettings()}
            >
              Open device settings
            </Button>
          </div>
        ) : null}

        {permissionKnown && state === "error" ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              {errorMessage || "Could not check notification permission."}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void enableNotifications()}
            >
              Enable notifications
            </Button>
          </div>
        ) : null}

        {permissionKnown && state === "unavailable" ? (
          <p className="text-muted-foreground text-sm">
            Notifications are unavailable on this device right now.
          </p>
        ) : null}

        {granted ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-xs">Notifications are allowed on this device.</p>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void disablePush()}>
              Turn off
            </Button>
          </div>
        ) : null}

        {TOPICS.map((topic) => (
          <div key={topic.id} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{topic.label}</p>
              <p className="text-muted-foreground text-xs">{topic.description}</p>
            </div>
            <Switch
              checked={Boolean(prefs[topic.id])}
              disabled={topicsDisabled}
              onCheckedChange={(checked) => void toggleTopic(topic.id, checked)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
