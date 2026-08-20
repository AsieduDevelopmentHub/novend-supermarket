"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  discoverScanners,
  getScannerConnectionState,
  loadTerminalScannerConfig,
  probeScannerBridge,
  saveTerminalScannerConfig,
  type DiscoveredScanner,
  type TerminalScannerConfig,
} from "@/services/hardware";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { formatOperatingSystem } from "@/lib/desktop";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, ScanBarcode, CheckCircle2, Info } from "lucide-react";

type BridgeSnapshot = {
  state: "unknown" | "online" | "offline";
  version: string | null;
  platform: string | null;
};

const INITIAL_BRIDGE: BridgeSnapshot = { state: "unknown", version: null, platform: null };

async function readBridgeSnapshot(): Promise<BridgeSnapshot> {
  const status = await probeScannerBridge();
  return {
    state: status.ok ? "online" : "offline",
    version: status.version ?? null,
    platform: status.platform ?? null,
  };
}

/** Desktop-only: configure barcode scanners for this terminal. */
export function ScannerPanel() {
  const [config, setConfig] = useState<TerminalScannerConfig>(() => loadTerminalScannerConfig());
  const [bridge, setBridge] = useState<BridgeSnapshot>(INITIAL_BRIDGE);
  const [discovered, setDiscovered] = useState<DiscoveredScanner[]>([]);
  const [pending, setPending] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  const isDesktopOnline = bridge.state === "online";
  const connection = getScannerConnectionState(config, isDesktopOnline);

  function patch(partial: Partial<TerminalScannerConfig>) {
    setConfig((prev) => ({ ...prev, ...partial }));
  }

  useEffect(() => {
    let cancelled = false;
    void readBridgeSnapshot().then((snapshot) => {
      if (!cancelled) setBridge(snapshot);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onDiscover() {
    setDiscovering(true);
    try {
      const snapshot = await readBridgeSnapshot();
      setBridge(snapshot);
      if (snapshot.state !== "online") {
        toast.error("Hardware bridge unavailable. Restart the app and try again.");
        return;
      }
      const result = await discoverScanners();
      setDiscovered(result.scanners);
      if (!result.ok) {
        toast.error(result.message || "Discover failed");
        return;
      }
      toast.success(result.message || "Devices refreshed");
      if (result.scanners.length === 1 && !config.deviceId) {
        const only = result.scanners[0]!;
        patch({ deviceId: only.id, deviceLabel: only.label });
      }
    } catch (error) {
      showError(error, "Discover failed");
    } finally {
      setDiscovering(false);
    }
  }

  function onSave() {
    setPending(true);
    try {
      saveTerminalScannerConfig(config);
      toast.success("Barcode scanner settings saved on this terminal");
    } catch (error) {
      showError(error, "Could not save scanner settings");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {connection === "connected" ? (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Scanner ready</AlertTitle>
          <AlertDescription>
            HID keyboard-wedge scans are enabled for POS. Selected: {config.deviceLabel || "—"}
            {bridge.version ? ` · Desktop ${bridge.version}` : null}
            {bridge.platform ? ` · ${formatOperatingSystem(bridge.platform)}` : null}
          </AlertDescription>
        </Alert>
      ) : connection === "disabled" ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Scanner disabled</AlertTitle>
          <AlertDescription>
            Enable the barcode scanner below to add products by scanning on the sales screen.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Not connected</AlertTitle>
          <AlertDescription>
            The desktop hardware bridge is offline or no scanner is selected. Restart Novend POS
            and click Discover Devices.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Connection status</CardTitle>
              <CardDescription>Per-terminal barcode scanner for this desktop install.</CardDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                connection === "connected" && "border-emerald-500/40 text-emerald-700",
                connection === "disabled" && "text-muted-foreground",
                connection === "not_connected" && "border-amber-500/40 text-amber-700",
              )}
            >
              {connection === "connected"
                ? "Connected"
                : connection === "disabled"
                  ? "Disabled"
                  : "Not connected"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="scanner-enabled"
              checked={config.enabled}
              onCheckedChange={(checked) => patch({ enabled: checked === true })}
            />
            <Label htmlFor="scanner-enabled" className="font-normal">
              Enable barcode scanner on this terminal
            </Label>
          </div>

          <Separator />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onDiscover()}
              disabled={discovering}
            >
              {discovering ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Discover Devices
            </Button>
            <p className="text-muted-foreground text-xs">
              USB HID scanners that type like a keyboard appear here. Dedicated USB/serial adapters
              will plug into the same discovery list later.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Preferred scanner</Label>
            <Select
              value={config.deviceId || undefined}
              onValueChange={(value) => {
                const match =
                  discovered.find((item) => item.id === value) ??
                  (value === config.deviceId
                    ? { id: config.deviceId, label: config.deviceLabel }
                    : undefined);
                patch({
                  deviceId: value,
                  deviceLabel: match?.label ?? value,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a scanner" />
              </SelectTrigger>
              <SelectContent>
                {config.deviceId && !discovered.some((item) => item.id === config.deviceId) ? (
                  <SelectItem value={config.deviceId}>{config.deviceLabel || config.deviceId}</SelectItem>
                ) : null}
                {discovered.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {discovered.length > 0 ? (
            <ul className="border-border divide-y rounded-lg border text-sm">
              {discovered.map((item) => (
                <li key={item.id} className="flex items-center gap-2 px-3 py-2">
                  <ScanBarcode className="text-muted-foreground h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.label}</p>
                    <p className="text-muted-foreground truncate text-xs">{item.mode}</p>
                  </div>
                  {config.deviceId === item.id ? (
                    <Badge variant="secondary">Selected</Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex justify-end">
            <Button type="button" onClick={onSave} disabled={pending}>
              {pending ? "Saving…" : "Save scanner"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
