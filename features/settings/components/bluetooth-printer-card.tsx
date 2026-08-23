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
  type BluetoothPrinterDevice,
  type BluetoothPrinterStatus,
} from "@novend/hardware";
import { Loader2, Printer, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";

export function BluetoothPrinterCard() {
  const [status, setStatus] = useState<BluetoothPrinterStatus | null>(null);
  const [devices, setDevices] = useState<BluetoothPrinterDevice[]>([]);
  const [busy, setBusy] = useState<"discover" | "connect" | "test" | "reconnect" | null>(null);

  async function refreshStatus() {
    const result = await Hardware.bluetoothPrinter.getStatus();
    if (result.ok && result.data) setStatus(result.data);
  }

  useEffect(() => {
    let cancelled = false;
    void Hardware.bluetoothPrinter.getStatus().then((result) => {
      if (!cancelled && result.ok && result.data) setStatus(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onDiscover() {
    setBusy("discover");
    try {
      const result = await Hardware.bluetoothPrinter.discover();
      if (!result.ok) {
        toast.error(result.message || "Could not discover printers");
        return;
      }
      setDevices(result.data?.devices ?? []);
      toast.success(
        result.data?.devices.length
          ? `Found ${result.data.devices.length} device(s)`
          : "No printers found nearby",
      );
    } finally {
      setBusy(null);
    }
  }

  async function onConnect(device: BluetoothPrinterDevice) {
    setBusy("connect");
    try {
      const result = await Hardware.bluetoothPrinter.connect(device.id, device.name);
      if (!result.ok) {
        toast.error(result.message || "Could not connect");
        return;
      }
      toast.success("Printer paired");
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
        toast.error(result.message || "Could not reconnect");
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
        toast.error(result?.message || "Test print failed");
        return;
      }
      toast.success("Test print sent");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Printer className="h-4 w-4" />
          Bluetooth printer
        </CardTitle>
        <CardDescription>
          Pair a 58mm or 80mm thermal printer for silent receipt printing on this device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status?.connected ? "success" : "secondary"}>
            {status?.connected ? "Connected" : "Not connected"}
          </Badge>
          {status?.deviceName ? (
            <p className="text-sm font-medium">{status.deviceName}</p>
          ) : (
            <p className="text-muted-foreground text-sm">No preferred printer saved</p>
          )}
        </div>

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

        <div className="flex items-center justify-between gap-3 rounded-[16px] border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Auto reconnect</p>
            <p className="text-muted-foreground text-xs">Retry the saved printer after a failed print</p>
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
            Discover printers
          </Button>
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
          <Button type="button" disabled={busy !== null || !status?.deviceId} onClick={() => void onTest()}>
            {busy === "test" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Test print
          </Button>
        </div>

        {devices.length > 0 ? (
          <ul className="space-y-2">
            {devices.map((device) => (
              <li
                key={device.id}
                className="flex items-center justify-between gap-2 rounded-[14px] border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{device.name}</p>
                  <p className="text-muted-foreground truncate text-xs">{device.id}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void onConnect(device)}
                >
                  Pair
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
