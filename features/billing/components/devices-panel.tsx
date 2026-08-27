"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Laptop, MonitorSmartphone, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
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
import { useDeviceFingerprint } from "@/hooks/use-device-fingerprint";
import { usePermissions } from "@/hooks/use-permissions";
import { formatDeviceRuntime } from "@/lib/device";
import { showError } from "@/lib/errors";
import { toast } from "sonner";
import { PlanLimitNotice } from "@/features/billing/components/plan-limit-notice";

type DeviceConfirm =
  | { kind: "shutdown"; id: Id<"devices"> }
  | { kind: "reenable"; id: Id<"devices"> }
  | { kind: "remove"; id: Id<"devices"> }
  | { kind: "shutdownOthers" };

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
  const fingerprint = useDeviceFingerprint();
  const data = useQuery(
    api.devices.listDevices,
    online && fingerprint ? { fingerprint } : "skip",
  );
  const renameDevice = useMutation(api.devices.renameDevice);
  const deactivateDevice = useMutation(api.devices.deactivateDevice);
  const deactivateOtherDevices = useMutation(api.devices.deactivateOtherDevices);
  const reactivateDevice = useMutation(api.devices.reactivateDevice);
  const removeDevice = useMutation(api.devices.removeDevice);
  const [renaming, setRenaming] = useState<{ id: Id<"devices">; name: string } | null>(null);
  const [confirm, setConfirm] = useState<DeviceConfirm | null>(null);
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
      setConfirm(null);
    }
  }

  async function onReenable(deviceId: Id<"devices">) {
    setPending(true);
    try {
      await reactivateDevice({ deviceId });
      toast.success("Device re-enabled");
    } catch (error) {
      showError(error, "Could not re-enable this device");
    } finally {
      setPending(false);
      setConfirm(null);
    }
  }

  async function onRemove(deviceId: Id<"devices">) {
    setPending(true);
    try {
      await removeDevice({ deviceId, currentFingerprint: fingerprint });
      toast.success("Device removed");
    } catch (error) {
      showError(error, "Could not remove this device");
    } finally {
      setPending(false);
      setConfirm(null);
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
      setConfirm(null);
    }
  }

  const confirmTargetName =
    confirm && confirm.kind !== "shutdownOthers"
      ? (data.devices.find((device) => device.id === confirm.id)?.name ?? "this device")
      : null;

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
            You cannot shut down or remove this device while you are using it. Shut-down terminals
            can be re-enabled or removed from the list.
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
              <Button type="button" variant="outline" onClick={() => setConfirm({ kind: "shutdownOthers" })}>
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
                      {device.isActive ? null : <Badge variant="secondary">Shut down</Badge>}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {device.platform} · {formatDeviceRuntime(device.runtime)}
                      {device.appVersion ? ` · v${device.appVersion}` : ""} · {device.userName} ·{" "}
                      {formatLastSeen(device.lastSeenAt)}
                    </p>
                  </div>
                  {isAdmin ? (
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
                      {device.isActive && !device.isCurrent ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Shut down ${device.name}`}
                          onClick={() => setConfirm({ kind: "shutdown", id: device.id })}
                        >
                          <PowerOff className="h-4 w-4" aria-hidden />
                        </Button>
                      ) : null}
                      {!device.isActive ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={
                            atLimit
                              ? `Cannot re-enable ${device.name}: device limit reached`
                              : `Re-enable ${device.name}`
                          }
                          disabled={atLimit}
                          title={atLimit ? "Shut down another terminal first" : undefined}
                          onClick={() => setConfirm({ kind: "reenable", id: device.id })}
                        >
                          <Power className="h-4 w-4" aria-hidden />
                        </Button>
                      ) : null}
                      {!device.isCurrent && !device.isActive ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${device.name}`}
                          onClick={() => setConfirm({ kind: "remove", id: device.id })}
                        >
                          <Trash2 className="text-destructive h-4 w-4" aria-hidden />
                        </Button>
                      ) : null}
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
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={
          confirm?.kind === "shutdownOthers"
            ? "Shut down all other devices?"
            : confirm?.kind === "shutdown"
              ? `Shut down ${confirmTargetName}?`
              : confirm?.kind === "reenable"
                ? `Re-enable ${confirmTargetName}?`
                : `Remove ${confirmTargetName}?`
        }
        description={
          confirm?.kind === "shutdownOthers"
            ? `This device stays on. ${otherActiveCount} other activated terminal${otherActiveCount === 1 ? "" : "s"} will lose ${otherActiveCount === 1 ? "its" : "their"} slot immediately. Anyone signing in on those terminals again will need a free slot.`
            : confirm?.kind === "shutdown"
              ? "It frees an activation slot immediately. You can re-enable it here later, or anyone signing in on that terminal will need a free slot. The terminal you are using stays on."
              : confirm?.kind === "reenable"
                ? "It uses one activation slot again. That terminal can keep working without a new sign-in."
                : "It leaves this list and no longer uses a slot. Signing in on that terminal later is treated as a new device and needs a free slot."
        }
        confirmLabel={
          confirm?.kind === "shutdownOthers"
            ? "Shut down others"
            : confirm?.kind === "shutdown"
              ? "Shut down"
              : confirm?.kind === "reenable"
                ? "Re-enable"
                : "Remove"
        }
        confirmVariant={confirm?.kind === "reenable" ? "default" : "destructive"}
        pending={pending}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === "shutdownOthers") void onShutdownOthers();
          else if (confirm.kind === "shutdown") void onDeactivate(confirm.id);
          else if (confirm.kind === "reenable") void onReenable(confirm.id);
          else void onRemove(confirm.id);
        }}
      />
    </div>
  );
}
