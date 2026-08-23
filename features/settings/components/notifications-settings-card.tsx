"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Hardware, type NotificationTopic } from "@novend/hardware";
import { Bell } from "lucide-react";
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

  useEffect(() => {
    void (async () => {
      const permission = await Hardware.notifications.checkPermissions();
      setGranted(Boolean(permission.data?.granted));
      const topics = await Hardware.notifications.getTopicPrefs();
      if (topics.data) setPrefs(topics.data);
    })();
  }, []);

  async function enableNotifications() {
    const result = await Hardware.notifications.requestPermissions();
    setGranted(Boolean(result.data?.granted));
    if (!result.ok || !result.data?.granted) {
      toast.error(result.message || "Notifications were not enabled");
      return;
    }
    toast.success("Notifications enabled");
  }

  async function toggleTopic(id: NotificationTopic, enabled: boolean) {
    if (!granted && enabled) {
      await enableNotifications();
    }
    await Hardware.notifications.setTopicPrefs({ [id]: enabled });
    const topics = await Hardware.notifications.getTopicPrefs();
    if (topics.data) setPrefs(topics.data);
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
        {!granted ? (
          <Button type="button" variant="outline" onClick={() => void enableNotifications()}>
            Enable notifications
          </Button>
        ) : null}
        {TOPICS.map((topic) => (
          <div key={topic.id} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{topic.label}</p>
              <p className="text-muted-foreground text-xs">{topic.description}</p>
            </div>
            <Switch
              checked={Boolean(prefs?.[topic.id])}
              onCheckedChange={(checked) => void toggleTopic(topic.id, checked)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
