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
  BARCODE_HID_CAPTURE_MS,
  discoverScanners,
  getScannerConnectionState,
  loadTerminalScannerConfig,
  playScanSuccessBeep,
  probeScannerBridge,
  rememberLastScan,
  saveTerminalScannerConfig,
  type DiscoveredScanner,
  type TerminalScannerConfig,
} from "@/services/hardware";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { ScanBarcodeCameraDialog } from "@/components/hardware/scan-barcode-camera-dialog";
import { toast } from "sonner";
import { showError, toUserMessage } from "@/lib/errors";
import { formatOperatingSystem, isDesktopRuntime } from "@/lib/desktop";
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

/** Per-terminal barcode scanner: HID wedge, USB discovery, camera test. */
export function ScannerPanel() {
  const [config, setConfig] = useState<TerminalScannerConfig>(() => loadTerminalScannerConfig());
  const [bridge, setBridge] = useState<BridgeSnapshot>(INITIAL_BRIDGE);
  const [discovered, setDiscovered] = useState<DiscoveredScanner[]>([]);
  const [pending, setPending] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [listening, setListening] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const isDesktopOnline = bridge.state === "online";
  const isDesktopApp = isDesktopRuntime();
  const connection = getScannerConnectionState(config, isDesktopOnline, listening);

  useBarcodeScanner(
    (code) => {
      if (!listening) return;
      rememberLastScan(code, config);
      setConfig(loadTerminalScannerConfig());
      setListening(false);
      playScanSuccessBeep();
      toast.success(`Scanned ${code}`);
    },
    {
      enabled: listening,
      allowInInputs: true,
      timeoutMs: BARCODE_HID_CAPTURE_MS,
      onTimeout: () => {
        setListening(false);
        toast.message("Scanner test timed out");
      },
    },
  );

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

      const result = await discoverScanners();
      setDiscovered(result.scanners);

      if (!result.ok) {
        const fallback = isDesktopApp
          ? "Could not find scanners. Restart Novend POS and try again."
          : "Could not refresh the scanner list. Try again.";
        toast.error(
          result.message ? toUserMessage(result.message, fallback) : fallback,
        );
        return;
      }

      toast.success(result.message || "Scanner list updated");
      if (result.scanners.length === 1 && !config.deviceId) {
        const only = result.scanners[0]!;
        patch({ deviceId: only.id, deviceLabel: only.label });
      }
    } catch (error) {
      showError(error, "Could not refresh scanners");
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
      {connection === "listening" ? (
        <Alert>
          <ScanBarcode className="h-4 w-4" />
          <AlertTitle>Listening</AlertTitle>
          <AlertDescription>
            Scan a barcode now. Listening stops after the first scan or 18 seconds.
          </AlertDescription>
        </Alert>
      ) : connection === "connected" ? (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Scanner ready</AlertTitle>
          <AlertDescription>
            HID keyboard-wedge scans are enabled for POS. Selected: {config.deviceLabel || "—"}
            {isDesktopApp && bridge.version ? ` · Desktop ${bridge.version}` : null}
            {isDesktopApp && bridge.platform ? ` · ${formatOperatingSystem(bridge.platform)}` : null}
            {!isDesktopApp ? " · Browser mode — use Sales to scan with camera or a USB wedge." : null}
          </AlertDescription>
        </Alert>
      ) : connection === "disabled" ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Scanner disabled</AlertTitle>
          <AlertDescription>
            Enable the barcode scanner below to add products by scanning on the sales screen.
            {!isDesktopApp
              ? " You can also use the barcode icon on Sales to scan with your camera."
              : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {!isDesktopApp && connection !== "listening" ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Browser scanning</AlertTitle>
          <AlertDescription>
            In the web app, plug in a USB scanner that types like a keyboard, or use the barcode
            icon on Sales to scan with your camera. Discover Devices does not require the desktop
            app.
          </AlertDescription>
        </Alert>
      ) : isDesktopApp && !isDesktopOnline && connection !== "listening" ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Desktop connection starting</AlertTitle>
          <AlertDescription>
            USB scanner discovery works best after Novend POS has fully started. Keyboard-wedge
            scanning still works on the sales screen.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Connection status</CardTitle>
              <CardDescription>
                {isDesktopApp
                  ? "Barcode scanner settings for this Novend POS terminal."
                  : "Barcode scanner settings for this browser or PWA session."}
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                connection === "connected" && "border-emerald-500/40 text-emerald-700",
                connection === "listening" && "border-teal-500/40 text-teal-700",
                connection === "disabled" && "text-muted-foreground",
                connection === "not_connected" && "border-amber-500/40 text-amber-700",
              )}
            >
              {connection === "connected"
                ? "Connected"
                : connection === "listening"
                  ? "Listening"
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
              {isDesktopApp
                ? "Lists USB HID scanners and keyboard-wedge devices connected to this terminal."
                : "In the browser, this selects keyboard-wedge mode. Use the barcode icon on Sales for camera scanning."}
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

          {config.lastDetectedCode ? (
            <p className="text-muted-foreground text-xs">
              Last detected: <span className="text-foreground font-medium">{config.lastDetectedCode}</span>
              {config.lastDetectedAt
                ? ` · ${new Date(config.lastDetectedAt).toLocaleString()}`
                : null}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setListening(true)}
              disabled={!config.enabled || listening}
            >
              <ScanBarcode className="mr-2 h-4 w-4" />
              {listening ? "Listening…" : "Test scanner"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setCameraOpen(true)}>
              <ScanBarcode className="mr-2 h-4 w-4" />
              Test camera
            </Button>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={onSave} disabled={pending}>
              {pending ? "Saving…" : "Save scanner"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <ScanBarcodeCameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onDetect={(code) => {
          rememberLastScan(code, config);
          setConfig(loadTerminalScannerConfig());
          playScanSuccessBeep();
          toast.success(`Camera scanned ${code}`);
        }}
      />
    </div>
  );
}
