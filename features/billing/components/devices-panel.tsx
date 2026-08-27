"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Laptop, MonitorSmartphone, Pencil, PowerOff } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePermissions } from "@/hooks/use-permissions";
import { formatDeviceRuntime, getDeviceFingerprint } from "@/lib/device";
import { showError } from "@/lib/errors";
import { toast } from "sonner";
import { PlanLimitNotice } from "@/features/billing/components/plan-limit-notice";

function formatLastSeen(value: number) {
  const diff = Date.now() - value;
  if (diff < 2 * 60 * 1000) return "Active now";
  if (diff < 60 * 60 * 1000) return `${Math.round(diff / 60000)} min ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.round(diff / 3600000)} h ago`;
  return new Date(value).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Settings → Devices. Shows every activated terminal and frees licence slots. */
export function DevicesPanel() {
  const online = useConnectivity();
  const { isAdmin } = usePermissions();
  const fingerprint = useMemo(() => getDeviceFingerprint(), []);
  const data = useQuery(api.devices.listDevices, online ? { fingerprint } : "skip");
  const renameDevice = useMutation(api.devices.renameDevice);
  const deactivateDevice = useMutation(api.devices.deactivateDevice);
  const deactivateOtherDevices = useMutation(api.devices.deactivateOtherDevices);
  const [renaming, setRenaming] = useState<{ id: Id<"devices">; name: string } | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Id<"devices"> | null>(null);
  const [confirmShutdownOthers, setConfirmShutdownOthers] = useState(false);
  const [pending, setPending] = useState(false);

  if (!online) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-5 text-sm">
          Device management needs a connection. Reconnect to review activated terminals.
        </CardContent>
      </Card>
    );
  }

  if (data === undefined) {
    return <LoadingState label="Loading devices…" variant="table" />;
  }

  const atLimit = data.limit !== null && data.activeCount >= data.limit;
  const otherActiveCount = data.devices.filter((device) => device.isActive && !device.isCurrent)
    .length;

  async function onRename() {
    if (!renaming) return;
    setPending(true);
    try {
      await renameDevice({ deviceId: renaming.id, name: renaming.name });
      toast.success("Device renamed");
      setRenaming(null);
    } catch (error) {
      showError(error, "Could not rename this device");
    } finally {
      setPending(false);
    }
  }

  async function onDeactivate(deviceId: Id<"devices">) {
    setPending(true);
    try {
      await deactivateDevice({ deviceId, currentFingerprint: fingerprint });
      toast.success("Device shut down");
    } catch (error) {
      showError(error, "Could not shut down this device");
    } finally {
      setPending(false);
      setConfirmDeactivate(null);
    }
  }

  async function onShutdownOthers() {
    setPending(true);
    try {
      const result = await deactivateOtherDevices({ currentFingerprint: fingerprint });
      toast.success(
        result.count === 0
          ? "No other devices were active"
          : `Shut down ${result.count} other device${result.count === 1 ? "" : "s"}`,
      );
    } catch (error) {
      showError(error, "Could not shut down other devices");
    } finally {
      setPending(false);
      setConfirmShutdownOthers(false);
    }
  }

  return (
    <div className="space-y-4">
      <PlanLimitNotice resource="devices" />
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <MonitorSmartphone className="h-4 w-4" aria-hidden />
            Activated devices
            <Badge variant={atLimit ? "warning" : "secondary"}>
              {data.activeCount} / {data.limit === null ? "∞" : data.limit}
            </Badge>
          </CardTitle>
          <CardDescription>
            Every signed-in installation uses one slot — desktop app, Android/iOS app, or browser.
            You cannot shut down this device while you are using it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {atLimit ? (
            <Alert>
              <AlertTitle>Device limit reached</AlertTitle>
              <AlertDescription>
                Shut down a device you no longer use, or upgrade your plan to activate more
                terminals. This device stays on.
              </AlertDescription>
            </Alert>
          ) : null}

          {isAdmin && otherActiveCount > 0 ? (
            <div className="flex flex-wrap justify-end">
              <Button type="button" variant="outline" onClick={() => setConfirmShutdownOthers(true)}>
                <PowerOff className="h-4 w-4" aria-hidden />
                Shut down all except this device
              </Button>
            </div>
          ) : null}

          {data.devices.length === 0 ? (
            <EmptyState
              icon={Laptop}
              title="No devices yet"
              description="Devices register automatically the first time someone signs in on them."
            />
          ) : (
            <ul className="border-border divide-border divide-y rounded-lg border">
              {data.devices.map((device) => (
                <li
                  key={device.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className="truncate">{device.name}</span>
                      {device.isCurrent ? <Badge variant="outline">This device</Badge> : null}
                      {device.isActive ? null : <Badge variant="secondary">Deactivated</Badge>}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {device.platform} · {formatDeviceRuntime(device.runtime)}
                      {device.appVersion ? ` · v${device.appVersion}` : ""} · {device.userName} ·{" "}
                      {formatLastSeen(device.lastSeenAt)}
                    </p>
                  </div>
                  {isAdmin && device.isActive ? (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Rename ${device.name}`}
                        onClick={() => setRenaming({ id: device.id, name: device.name })}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                      {device.isCurrent ? null : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Shut down ${device.name}`}
                          onClick={() => setConfirmDeactivate(device.id)}
                        >
                          <PowerOff className="h-4 w-4" aria-hidden />
                        </Button>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename device</DialogTitle>
            <DialogDescription>
              Give this terminal a name your team recognises, like “Counter 1” or “Manager laptop”.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="device-name">Device name</Label>
            <Input
              id="device-name"
              value={renaming?.name ?? ""}
              maxLength={60}
              onChange={(event) =>
                setRenaming((current) =>
                  current ? { ...current, name: event.target.value } : current,
                )
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button disabled={pending || !renaming?.name.trim()} onClick={() => void onRename()}>
              {pending ? "Saving…" : "Save name"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeactivate !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeactivate(null);
        }}
        title="Shut down this device?"
        description="It frees an activation slot immediately. Anyone signing in on that terminal again will need a free slot. The terminal you are using stays on."
        confirmLabel="Shut down"
        pending={pending}
        onConfirm={() => {
          if (confirmDeactivate) void onDeactivate(confirmDeactivate);
        }}
      />

      <ConfirmDialog
        open={confirmShutdownOthers}
        onOpenChange={(open) => {
          if (!open) setConfirmShutdownOthers(false);
        }}
        title="Shut down all other devices?"
        description={`This device stays on. ${otherActiveCount} other activated terminal${otherActiveCount === 1 ? "" : "s"} will lose ${otherActiveCount === 1 ? "its" : "their"} slot immediately. Anyone signing in on those terminals again will need a free slot.`}
        confirmLabel="Shut down others"
        pending={pending}
        onConfirm={() => {
          void onShutdownOthers();
        }}
      />
    </div>
  );
}
