"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Hardware,
  NATIVE_AVAILABILITY_TIMEOUT_MS,
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

export function NotificationsSettingsCard() {
  const [state, setState] = useState<NotificationPermissionState>("not-requested");
  const [prefs, setPrefs] = useState<Record<NotificationTopic, boolean> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const permission = await Hardware.notifications.checkPermissions();
      setState(permission.data?.state ?? (permission.data?.granted ? "granted" : "not-requested"));
      setErrorMessage(permission.ok ? null : permission.message || null);
      const topics = await Hardware.notifications.getTopicPrefs();
      setPrefs(topics.data ?? EMPTY_PREFS);
    } catch {
      setState("error");
      setErrorMessage("Could not check notification permission.");
      setPrefs(EMPTY_PREFS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const hardStop = window.setTimeout(() => {
      if (cancelled) return;
      setLoading((stillLoading) => {
        if (stillLoading) {
          setState((current) =>
            current === "prompt" || current === "not-requested" ? "error" : current,
          );
          setErrorMessage((msg) => msg ?? "Notification permission check timed out. Try again.");
          setPrefs((current) => current ?? EMPTY_PREFS);
        }
        return false;
      });
    }, NATIVE_AVAILABILITY_TIMEOUT_MS + 2000);

    void (async () => {
      await refresh();
      if (!cancelled) window.clearTimeout(hardStop);
    })();

    let remove: (() => Promise<void>) | null = null;
    void Hardware.app.addAppStateListener((isActive) => {
      if (isActive) void refresh();
    }).then((handle) => {
      remove = handle.remove;
    });

    return () => {
      cancelled = true;
      window.clearTimeout(hardStop);
      void remove?.();
    };
  }, [refresh]);

  async function enableNotifications() {
    setBusy(true);
    try {
      toast.message(permissionNeedMessage("notifications"));
      const result = await Hardware.notifications.requestPermissions();
      const next = result.data?.state ?? (result.data?.granted ? "granted" : "denied");
      setState(next);
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
      if (state !== "granted" && enabled) {
        if (state === "permanently-denied") {
          toast.message(permissionDeniedMessage("notifications"));
          await openSettings();
          return;
        }
        if (state === "unavailable") {
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

  const granted = state === "granted";
  const topicsDisabled =
    busy || prefs === null || state === "unavailable" || state === "permanently-denied";

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
        {loading ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Checking notification permission…
          </p>
        ) : null}

        {!loading && (state === "prompt" || state === "not-requested") ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">{permissionNeedMessage("notifications")}</p>
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

        {!loading && state === "denied" ? (
          <div className="space-y-2">
            <p className="text-sm">{permissionDeniedMessage("notifications")}</p>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void enableNotifications()}>
              Try again
            </Button>
          </div>
        ) : null}

        {!loading && state === "permanently-denied" ? (
          <div className="space-y-2">
            <p className="text-sm">Notifications are blocked for Novend on this device.</p>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void openSettings()}>
              Open device settings
            </Button>
          </div>
        ) : null}

        {!loading && state === "error" ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              {errorMessage || "Could not check notification permission. Try again."}
            </p>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void refresh()}>
              Try again
            </Button>
          </div>
        ) : null}

        {!loading && state === "unavailable" ? (
          <p className="text-muted-foreground text-sm">
            Notifications are unavailable on this device right now. You can still use Novend
            normally.
          </p>
        ) : null}

        {!loading && granted ? (
          <p className="text-muted-foreground text-xs">Notifications are allowed on this device.</p>
        ) : null}

        {!loading
          ? TOPICS.map((topic) => (
              <div key={topic.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{topic.label}</p>
                  <p className="text-muted-foreground text-xs">{topic.description}</p>
                </div>
                <Switch
                  checked={Boolean(prefs?.[topic.id])}
                  disabled={topicsDisabled}
                  onCheckedChange={(checked) => void toggleTopic(topic.id, checked)}
                />
              </div>
            ))
          : null}
      </CardContent>
    </Card>
  );
}
