"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Hardware, type NotificationTopic } from "@novend/hardware";
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

export function NotificationsSettingsCard() {
  const [granted, setGranted] = useState(false);
  const [prefs, setPrefs] = useState<Record<NotificationTopic, boolean> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const permission = await Hardware.notifications.checkPermissions();
        if (cancelled) return;
        setGranted(Boolean(permission.data?.granted));
        const topics = await Hardware.notifications.getTopicPrefs();
        if (cancelled) return;
        if (topics.data) setPrefs(topics.data);
        else {
          setPrefs({
            stock_alerts: false,
            daily_summary: false,
            branch_transfers: false,
            subscription_alerts: false,
          });
        }
      } catch {
        if (!cancelled) {
          setLoadError("Could not read notification settings on this device.");
          setPrefs({
            stock_alerts: false,
            daily_summary: false,
            branch_transfers: false,
            subscription_alerts: false,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enableNotifications() {
    setBusy(true);
    try {
      const result = await Hardware.notifications.requestPermissions();
      setGranted(Boolean(result.data?.granted));
      if (!result.ok || !result.data?.granted) {
        toast.error(result.message || "Notifications were not enabled");
        return false;
      }
      toast.success("Notifications enabled");
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function toggleTopic(id: NotificationTopic, enabled: boolean) {
    setBusy(true);
    try {
      if (!granted && enabled) {
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
        {loadError ? <p className="text-destructive text-sm">{loadError}</p> : null}
        {!loading && !granted ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void enableNotifications()}
          >
            Enable notifications
          </Button>
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
                  disabled={busy || prefs === null}
                  onCheckedChange={(checked) => void toggleTopic(topic.id, checked)}
                />
              </div>
            ))
          : null}
      </CardContent>
    </Card>
  );
}
