"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Hardware,
  permissionDeniedMessage,
  permissionNeedMessage,
  type NotificationPermissionState,
  type NotificationTopic,
} from "@novend/hardware";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TOPICS: Array<{ id: NotificationTopic; label: string; description: string }> = [
  {
    id: "stock_alerts",
    label: "Stock alerts",
    description: "Low stock and expiry reminders on this device",
  },
  {
    id: "daily_summary",
    label: "Daily summary",
    description: "End-of-day sales snapshot",
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

/**
 * Local notification prefs. Never auto-probe Cap permission on mount —
 * LocalNotifications / NovendPermissions can block the WebView bridge and
 * freeze Security (spinners die within ~1s). Load Preferences only; probe on tap.
 */
export function NotificationsSettingsCard() {
  const [state, setState] = useState<NotificationPermissionState>("not-requested");
  const [prefs, setPrefs] = useState<Record<NotificationTopic, boolean>>(EMPTY_PREFS);
  const [permissionKnown, setPermissionKnown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshPermission = useCallback(async () => {
    setChecking(true);
    setErrorMessage(null);
    try {
      const permission = await Hardware.notifications.checkPermissions();
      setState(
        permission.data?.state ?? (permission.data?.granted ? "granted" : "not-requested"),
      );
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

  async function enableNotifications() {
    setBusy(true);
    try {
      const result = await Hardware.notifications.requestPermissions();
      const next = result.data?.state ?? (result.data?.granted ? "granted" : "denied");
      setState(next);
      setPermissionKnown(true);
      setErrorMessage(result.ok ? null : result.message || null);
      if (!result.ok || !result.data?.granted) {
        toast.error(result.message || permissionDeniedMessage("notifications"));
        return false;
      }
      toast.success("Notifications enabled");
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function openSettings() {
    const result = await Hardware.app.openAppSettings();
    if (!result.ok) {
      toast.message(result.message || "Open Android Settings → Apps → Novend → Permissions.");
    }
  }

  async function toggleTopic(id: NotificationTopic, enabled: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (!permissionKnown) {
        await refreshPermission();
      }
      if (state !== "granted" && enabled) {
        const current = permissionKnown ? state : "not-requested";
        if (current === "permanently-denied") {
          toast.message(permissionDeniedMessage("notifications"));
          await openSettings();
          return;
        }
        if (current === "unavailable") {
          toast.message("Notifications are unavailable on this device.");
          return;
        }
        const ok = await enableNotifications();
        if (!ok) return;
      }
      await Hardware.notifications.setTopicPrefs({ [id]: enabled });
      const topics = await Hardware.notifications.getTopicPrefs();
      if (topics.data) setPrefs(topics.data);
    } finally {
      setBusy(false);
    }
  }

  const granted = permissionKnown && state === "granted";
  const topicsDisabled =
    busy || checking || (permissionKnown && (state === "unavailable" || state === "permanently-denied"));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Notifications
        </CardTitle>
        <CardDescription>
          Local alerts on this device. Cloud push delivery can be connected later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!permissionKnown && !checking ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">{permissionNeedMessage("notifications")}</p>
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
              Try again
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
              {errorMessage || "Could not check notification permission. Try again."}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void refreshPermission()}
            >
              Try again
            </Button>
          </div>
        ) : null}

        {permissionKnown && state === "unavailable" ? (
          <p className="text-muted-foreground text-sm">
            Notifications are unavailable on this device right now. You can still use Novend
            normally.
          </p>
        ) : null}

        {granted ? (
          <p className="text-muted-foreground text-xs">Notifications are allowed on this device.</p>
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
