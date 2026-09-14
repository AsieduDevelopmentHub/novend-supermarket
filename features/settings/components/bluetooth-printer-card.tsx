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
import { Loader2, Printer, RefreshCw, Settings2, Trash2, Unplug } from "lucide-react";
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
      return "No printer";
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

export function BluetoothPrinterCard() {
  const [status, setStatus] = useState<BluetoothPrinterStatus | null>(null);
  const [devices, setDevices] = useState<BluetoothPrinterDevice[]>([]);
  const [busy, setBusy] = useState<
    "discover" | "connect" | "test" | "reconnect" | "forget" | null
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

  async function onDiscover() {
    setBusy("discover");
    try {
      const transport = status?.transport ?? "ble";
      const result = await Hardware.bluetoothPrinter.discover({ transport });
      if (!result.ok) {
        toast.error(
          result.message || bluetoothPrintFailedMessage(result.code, "Could not discover printers"),
        );
        return;
      }
      setDevices(result.data?.devices ?? []);
      toast.success(
        result.data?.devices.length
          ? `Found ${result.data.devices.length} device(s)`
          : transport === "classic"
            ? "No paired printers found. Pair one in Android Bluetooth settings first."
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
        toast.error(result.message || bluetoothPrintFailedMessage(result.code, "Could not connect"));
        await refreshStatus();
        return;
      }
      toast.success("Printer paired");
      setDevices([]);
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
          result?.message ||
            bluetoothPrintFailedMessage(result?.code, "Test print failed"),
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
    await refreshStatus();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Printer className="h-4 w-4" />
          Bluetooth printer
        </CardTitle>
        <CardDescription>
          Pair one thermal printer for this tablet. Use Nearby BLE, or Android paired printers for
          Classic Bluetooth models.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
          {status?.transport ? (
            <Badge variant="outline">{status.transport === "classic" ? "Classic" : "BLE"}</Badge>
          ) : null}
          {status?.deviceName ? (
            <p className="text-sm font-medium">{status.deviceName}</p>
          ) : (
            <p className="text-muted-foreground text-sm">No preferred printer saved</p>
          )}
        </div>
        {status?.lastError ? (
          <p className="text-destructive text-sm">{status.lastError}</p>
        ) : null}

        {status?.classicAvailable ? (
          <div className="space-y-2">
            <Label>Printer type</Label>
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
                <SelectItem value="ble">Nearby BLE</SelectItem>
                <SelectItem value="classic">Android paired (Classic)</SelectItem>
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
          <p className="text-muted-foreground text-xs">
            Controls the physical ESC/POS layout for test and sale prints on this device.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-[16px] border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Auto reconnect</p>
            <p className="text-muted-foreground text-xs">
              Reconnect once before print and retry one failed write
            </p>
          </div>
          <Switch
            checked={status?.autoReconnect ?? true}
            onCheckedChange={(checked) => {
              void Hardware.bluetoothPrinter.setAutoReconnect(checked).then(() => refreshStatus());
            }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
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
            {status?.transport === "classic" ? "List paired printers" : "Discover printers"}
          </Button>
          {status?.classicAvailable && status.transport === "classic" ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => void Hardware.bluetoothPrinter.openBluetoothSettings()}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              Open Bluetooth settings
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null || !status?.deviceId}
            onClick={() => void onReconnect()}
          >
            Reconnect
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null || !status?.connected}
            onClick={() => void onDisconnect()}
          >
            <Unplug className="mr-2 h-4 w-4" />
            Disconnect
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null || !status?.deviceId}
            onClick={() => void onForget()}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Forget
          </Button>
          <Button
            type="button"
            disabled={busy !== null || !status?.deviceId}
            onClick={() => void onTest()}
          >
            {busy === "test" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Test print
          </Button>
        </div>

        {devices.length > 0 ? (
          <ul className="space-y-2">
            {devices.map((device) => (
              <li
                key={`${device.transport ?? "ble"}:${device.id}`}
                className="flex items-center justify-between gap-2 rounded-[14px] border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{device.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {device.bonded ? "Paired · " : ""}
                    {device.transport === "classic" ? "Classic · " : "BLE · "}
                    {device.id}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void onConnect(device)}
                >
                  {busy === "connect" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Connect
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
