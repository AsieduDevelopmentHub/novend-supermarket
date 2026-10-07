"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { formatRelative } from "@/lib/date";
import { showError } from "@/lib/errors";
import { cn } from "@/lib/utils";

export function NotificationBell({ tone = "header" }: { tone?: "header" | "sidebar" }) {
  const router = useRouter();
  const inbox = useAuthedQuery(api.appNotifications.mine, {});
  const markRead = useMutation(api.appNotifications.markRead);
  const markAllRead = useMutation(api.appNotifications.markAllRead);
  const clearAll = useMutation(api.appNotifications.clearAll);
  const setMuted = useMutation(api.appNotifications.setMuted);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const unread = inbox?.unread ?? 0;
  const muted = inbox?.muted === true;
  const items = inbox?.items ?? [];

  async function run(action: () => Promise<unknown>) {
    setPending(true);
    try {
      await action();
    } catch (error) {
      showError(error, "Could not update notifications");
    } finally {
      setPending(false);
    }
  }

  async function openItem(id: Id<"appNotifications">, href: string | null, read: boolean) {
    if (!read) {
      try {
        await markRead({ id });
      } catch {
        /* still navigate */
      }
    }
    setOpen(false);
    if (href?.startsWith("/")) router.push(href);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "relative shrink-0",
            tone === "sidebar" && "text-sidebar-foreground hover:bg-white/10 hover:text-white",
          )}
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          {muted ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          {unread > 0 ? (
            <span className="bg-primary text-primary-foreground absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(24rem,calc(100vw-1.5rem))] p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          <div className="flex items-center gap-2">
            <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span>Mute</span>
              <Switch
                checked={muted}
                disabled={pending || inbox === undefined}
                onCheckedChange={(checked) => void run(() => setMuted({ muted: checked }))}
                aria-label="Mute notifications"
              />
            </label>
          </div>
        </div>
        <div className="flex gap-1 border-b px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            disabled={pending || unread === 0}
            onClick={() => void run(() => markAllRead({}))}
          >
            <CheckCheck className="mr-1 h-3.5 w-3.5" />
            Mark all read
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            disabled={pending || items.length === 0}
            onClick={() => void run(() => clearAll({}))}
          >
            Clear all
          </Button>
        </div>
        <div className="max-h-[min(70dvh,24rem)] overflow-y-auto">
          {inbox === undefined ? (
            <p className="text-muted-foreground px-3 py-6 text-sm">Loading notifications…</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground px-3 py-6 text-sm">
              {muted
                ? "Notifications are muted. Stock, transfer, and billing alerts will wait."
                : "No alerts. Completed sales are not listed here."}
            </p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id} className="border-b last:border-b-0">
                  <button
                    type="button"
                    className="hover:bg-muted/60 w-full px-3 py-3 text-left"
                    onClick={() => void openItem(item.id, item.href, item.read)}
                  >
                    <span className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          item.read ? "bg-transparent" : "bg-primary",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{item.title}</span>
                        <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
                          {item.body}
                        </span>
                        <span className="text-muted-foreground mt-1 block text-[11px]">
                          {formatRelative(item.createdAt)}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
