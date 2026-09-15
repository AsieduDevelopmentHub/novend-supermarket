"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Hardware,
  bluetoothPrintFailedMessage,
  type BluetoothPrinterDevice,
  type BluetoothPrinterStatus,
  type BluetoothPrinterTransportKind,
} from "@novend/hardware";
import { Bluetooth, Loader2, Printer, RefreshCw, Settings2, Trash2, Unplug } from "lucide-react";
import { toast } from "sonner";

function statusLabel(status: BluetoothPrinterStatus | null): string {
  if (!status) return "Checking…";
  switch (status.connectionState) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting…";
    case "reconnecting":
      return "Reconnecting…";
    case "needs_attention":
      return "Needs attention";
    case "saved":
      return "Saved";
    default:
      return "Not set up";
  }
}

function statusVariant(
  status: BluetoothPrinterStatus | null,
): "success" | "secondary" | "warning" | "destructive" {
  if (!status) return "secondary";
  if (status.connectionState === "connected") return "success";
  if (status.connectionState === "needs_attention") return "destructive";
  if (status.connectionState === "saved") return "warning";
  return "secondary";
}

/**
 * Hardware → Bluetooth printer.
 * Classic (Android paired) is the reliable path after the hosted site loads.
 */
export function BluetoothPrinterCard() {
  const [status, setStatus] = useState<BluetoothPrinterStatus | null>(null);
  const [devices, setDevices] = useState<BluetoothPrinterDevice[]>([]);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [busy, setBusy] = useState<
    "permission" | "discover" | "connect" | "test" | "reconnect" | "forget" | null
  >(null);

  async function refreshStatus() {
    const result = await Hardware.bluetoothPrinter.getStatus();
    if (result.ok && result.data) setStatus(result.data);
  }

  useEffect(() => {
    let cancelled = false;
    void Hardware.bluetoothPrinter.getStatus().then((result) => {
      if (cancelled) return;
      if (result.ok && result.data) setStatus(result.data);
      else {
        setStatus({
          available: false,
          connected: false,
          connectionState: "none",
          deviceId: null,
          deviceName: null,
          paperWidthMm: 80,
          autoReconnect: true,
          transport: "ble",
          lastError: null,
          lastErrorCode: null,
          classicAvailable: false,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onEnableBluetooth() {
    setBusy("permission");
    try {
      const result = await Hardware.bluetoothPrinter.requestBluetoothPermission();
      if (!result.ok) {
        setNeedsPermission(true);
        toast.error(result.message || "Could not enable Bluetooth access");
        return;
      }
      setNeedsPermission(false);
      toast.success("Bluetooth access allowed");
      await onDiscover();
    } finally {
      setBusy(null);
    }
  }

  async function onDiscover() {
    setBusy("discover");
    try {
      const transport = status?.transport ?? "ble";
      const result = await Hardware.bluetoothPrinter.discover({ transport });
      if (!result.ok) {
        if (result.code === "permission") {
          setNeedsPermission(true);
          toast.message(result.message || "Enable Bluetooth / Nearby devices on this device.");
        } else {
          toast.error(
            result.message ||
              bluetoothPrintFailedMessage(result.code, "Could not discover printers"),
          );
        }
        return;
      }
      setNeedsPermission(false);
      setDevices(result.data?.devices ?? []);
      toast.success(
        result.data?.devices.length
          ? `Found ${result.data.devices.length} device(s)`
          : transport === "classic"
            ? "No paired printers found. Pair one in Bluetooth settings first."
            : "No printers found nearby",
      );
    } finally {
      setBusy(null);
    }
  }

  async function onConnect(device: BluetoothPrinterDevice) {
    setBusy("connect");
    try {
      const transport = device.transport ?? status?.transport ?? "ble";
      const result = await Hardware.bluetoothPrinter.connect(device.id, device.name, transport);
      if (!result.ok) {
        if (result.code === "permission") {
          setNeedsPermission(true);
        }
        toast.error(
          result.message || bluetoothPrintFailedMessage(result.code, "Could not connect"),
        );
        await refreshStatus();
        return;
      }
      toast.success("Printer connected");
      setDevices([]);
      setNeedsPermission(false);
      await refreshStatus();
    } finally {
      setBusy(null);
    }
  }

  async function onReconnect() {
    setBusy("reconnect");
    try {
      const result = await Hardware.bluetoothPrinter.reconnect();
      if (!result.ok) {
        toast.error(
          result.message || bluetoothPrintFailedMessage(result.code, "Could not reconnect"),
        );
        await refreshStatus();
        return;
      }
      toast.success("Printer reconnected");
      await refreshStatus();
    } finally {
      setBusy(null);
    }
  }

  async function onDisconnect() {
    await Hardware.bluetoothPrinter.disconnect();
    toast.message("Printer disconnected");
    await refreshStatus();
  }

  async function onForget() {
    setBusy("forget");
    try {
      await Hardware.bluetoothPrinter.forget();
      setDevices([]);
      toast.message("Printer forgotten");
      await refreshStatus();
    } finally {
      setBusy(null);
    }
  }

  async function onTest() {
    setBusy("test");
    try {
      const width = status?.paperWidthMm === 58 ? 58 : 80;
      const result = await Hardware.printer.testPrint?.({
        connectionType: "bluetooth",
        bluetoothDeviceId: status?.deviceId ?? undefined,
        paperWidthMm: width,
      });
      if (!result?.ok) {
        toast.error(
          result?.message || bluetoothPrintFailedMessage(result?.code, "Test print failed"),
        );
        await refreshStatus();
        return;
      }
      toast.success("Test print sent");
      await refreshStatus();
    } finally {
      setBusy(null);
    }
  }

  async function onTransportChange(next: BluetoothPrinterTransportKind) {
    const result = await Hardware.bluetoothPrinter.setTransport(next);
    if (!result.ok) {
      toast.error(result.message || "Could not switch printer type");
      return;
    }
    setDevices([]);
    setNeedsPermission(false);
    await refreshStatus();
  }

  const hasPrinter = Boolean(status?.deviceId);
  const isClassic = status?.transport === "classic";

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base">
          <Printer className="h-4 w-4" />
          Bluetooth printer
        </CardTitle>
        <CardDescription>
          Pair a thermal printer once, then use Test print to confirm receipts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Status */}
        <div className="bg-muted/40 space-y-3 rounded-[16px] border px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
            {status?.transport ? (
              <Badge variant="outline">{isClassic ? "Android paired" : "Nearby BLE"}</Badge>
            ) : null}
          </div>
          {status?.deviceName ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{status.deviceName}</p>
              <p className="text-muted-foreground text-xs">
                {status.connected ? "Ready to print" : "Saved — reconnect before printing"}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No printer selected. Enable Bluetooth access, then list paired devices.
            </p>
          )}
          {status?.lastError ? (
            <p className="text-destructive text-sm">{status.lastError}</p>
          ) : null}
          {hasPrinter ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                disabled={busy !== null}
                onClick={() => void onTest()}
              >
                {busy === "test" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Test print
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void onReconnect()}
              >
                Reconnect
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy !== null || !status?.connected}
                onClick={() => void onDisconnect()}
              >
                <Unplug className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => void onForget()}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Forget
              </Button>
            </div>
          ) : null}
        </div>

        {/* Permission + discover */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Find a printer</p>
          {needsPermission || status?.lastErrorCode === "permission" ? (
            <p className="text-muted-foreground text-sm">
              Novend needs Bluetooth / Nearby devices access on this phone before it can list
              paired printers.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              {isClassic
                ? "Use printers already paired in Android Bluetooth settings."
                : "Scan for nearby BLE printers. Classic paired printers are more reliable."}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={needsPermission ? "default" : "outline"}
              disabled={busy !== null}
              onClick={() => void onEnableBluetooth()}
            >
              {busy === "permission" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Bluetooth className="mr-2 h-4 w-4" />
              )}
              Enable Bluetooth / Nearby devices
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => void onDiscover()}
            >
              {busy === "discover" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {isClassic ? "List paired printers" : "Discover printers"}
            </Button>
            {status?.classicAvailable && isClassic ? (
              <Button
                type="button"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => void Hardware.bluetoothPrinter.openBluetoothSettings()}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Open Bluetooth settings
              </Button>
            ) : null}
          </div>
        </div>

        {devices.length > 0 ? (
          <ul className="space-y-2">
            {devices.map((device) => (
              <li
                key={`${device.transport ?? "ble"}:${device.id}`}
                className="flex items-center justify-between gap-2 rounded-[14px] border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{device.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {device.bonded ? "Paired · " : ""}
                    {device.transport === "classic" ? "Classic" : "BLE"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void onConnect(device)}
                >
                  {busy === "connect" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Connect
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        {/* Preferences */}
        <div className="space-y-4 border-t pt-4">
          <p className="text-sm font-medium">Print preferences</p>

          {status?.classicAvailable ? (
            <div className="space-y-2">
              <Label>Connection type</Label>
              <Select
                value={status.transport}
                onValueChange={(value) =>
                  void onTransportChange(value === "classic" ? "classic" : "ble")
                }
              >
                <SelectTrigger className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">Android paired (Classic) — recommended</SelectItem>
                  <SelectItem value="ble">Nearby BLE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Paper width</Label>
            <Select
              value={String(status?.paperWidthMm ?? 80)}
              onValueChange={(value) => {
                void Hardware.bluetoothPrinter
                  .setPaperWidth(value === "58" ? 58 : 80)
                  .then(() => refreshStatus());
              }}
            >
              <SelectTrigger className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="58">58 mm</SelectItem>
                <SelectItem value="80">80 mm</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Auto reconnect</p>
              <p className="text-muted-foreground text-xs">
                Reconnect once before print if the link dropped
              </p>
            </div>
            <Switch
              checked={status?.autoReconnect ?? true}
              onCheckedChange={(checked) => {
                void Hardware.bluetoothPrinter.setAutoReconnect(checked).then(() => refreshStatus());
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
