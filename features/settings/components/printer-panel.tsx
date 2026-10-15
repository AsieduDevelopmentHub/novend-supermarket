"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  discoverPrinters,
  loadTerminalPrinterConfig,
  probePrintBridge,
  saveTerminalPrinterConfig,
  testDesktopPrint,
  type DiscoveredWindowsPrinter,
  type TerminalPrinterConfig,
} from "@/services/printing";
import { toast } from "sonner";
import { showError, toUserMessage } from "@/lib/errors";
import { formatOperatingSystem } from "@/lib/desktop";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, Printer, Monitor, CheckCircle2, Info } from "lucide-react";

type BridgeSnapshot = {
  state: "unknown" | "online" | "offline";
  version: string | null;
  platform: string | null;
};

const INITIAL_BRIDGE: BridgeSnapshot = { state: "unknown", version: null, platform: null };

async function readBridgeSnapshot(): Promise<BridgeSnapshot> {
  const status = await probePrintBridge();
  return {
    state: status.ok ? "online" : "offline",
    version: status.version ?? null,
    platform: status.platform ?? null,
  };
}

/** Desktop-only panel: Settings hides it entirely when running in a browser. */
export function PrinterPanel() {
  const [config, setConfig] = useState<TerminalPrinterConfig>(() => loadTerminalPrinterConfig());
  const [bridge, setBridge] = useState<BridgeSnapshot>(INITIAL_BRIDGE);
  const [discovered, setDiscovered] = useState<DiscoveredWindowsPrinter[]>([]);
  const [pending, setPending] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  const isDesktopOnline = bridge.state === "online";

  function patch(partial: Partial<TerminalPrinterConfig>) {
    setConfig((prev) => ({ ...prev, ...partial }));
  }

  async function refreshStatus() {
    const snapshot = await readBridgeSnapshot();
    setBridge(snapshot);
    return snapshot;
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
      const snapshot = await refreshStatus();
      if (snapshot.state !== "online") {
        toast.error("Hardware bridge unavailable. Restart the app and try again.");
        setDiscovered([]);
        return;
      }

      const result = await discoverPrinters();
      if (!result.ok) {
        toast.error(toUserMessage(result.message, "Could not discover printers"));
        setDiscovered([]);
        return;
      }

      setDiscovered(result.windowsPrinters);
      if (result.windowsPrinters.length === 0) {
        toast.message("No printers found on this terminal");
        return;
      }

      if (result.suggested) {
        patch({
          connectionType: result.suggested.connectionType,
          windowsPrinterName: result.suggested.windowsPrinterName,
          printerHost: result.suggested.printerHost || config.printerHost,
          printerPort: result.suggested.printerPort || config.printerPort,
        });
        toast.success(
          `Found ${result.windowsPrinters.length} printer(s). Suggested settings applied — review and Save.`,
        );
      } else {
        toast.success(`Found ${result.windowsPrinters.length} printer(s)`);
      }
    } catch (error) {
      showError(error, "Printer discovery failed");
    } finally {
      setDiscovering(false);
    }
  }

  function applyDiscovered(printer: DiscoveredWindowsPrinter) {
    if (printer.networkHost) {
      patch({
        connectionType: "network",
        windowsPrinterName: printer.name,
        printerHost: printer.networkHost,
        printerPort: printer.networkPort ?? 9100,
      });
      toast.success(`Applied network printer “${printer.name}”`);
      return;
    }
    patch({
      connectionType: "windows",
      windowsPrinterName: printer.name,
    });
    toast.success(`Applied printer “${printer.name}”`);
  }

  async function onSave() {
    setPending(true);
    try {
      saveTerminalPrinterConfig(config);
      await refreshStatus();
      toast.success("Printer settings saved for this terminal");
    } catch (error) {
      showError(error, "Could not save printer settings");
    } finally {
      setPending(false);
    }
  }

  async function onTest() {
    setPending(true);
    try {
      const snapshot = await refreshStatus();
      if (snapshot.state !== "online") {
        toast.error("Hardware bridge unavailable. Restart the app and try again.");
        return;
      }
      const result = await testDesktopPrint(config);
      if (result.ok) {
        toast.success(result.message || "Test print sent");
      } else {
        toast.error(toUserMessage(result.message, "Test print failed"));
      }
    } finally {
      setPending(false);
    }
  }

  const showNetworkFields = config.connectionType === "network" || config.connectionType === "auto";
  const showWindowsField = config.connectionType === "windows" || config.connectionType === "auto";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>This terminal’s printer</CardTitle>
              <CardDescription>
                Device-local settings for this till.
              </CardDescription>
            </div>
            <RuntimeBadge bridge={bridge} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDesktopOnline ? (
            <Alert variant="success">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Hardware ready</AlertTitle>
              <AlertDescription>
                Silent ESC/POS printing and printer discovery are available on this terminal.
              </AlertDescription>
            </Alert>
          ) : bridge.state === "offline" ? (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertTitle>Hardware bridge unavailable</AlertTitle>
              <AlertDescription>
                Restart Millie&apos;s Supermarket, then refresh this status.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || !isDesktopOnline}
              onClick={() => void onTest()}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              Test print
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={discovering || pending || !isDesktopOnline}
              onClick={() => void onDiscover()}
            >
              {discovering ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Discover printers
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => void refreshStatus()}
            >
              <Monitor className="h-4 w-4" />
              Refresh status
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Print behaviour</CardTitle>
          <CardDescription>
            Hardware options for this terminal. Whether receipts print after a sale is set under
            Receipt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow
            checked={config.preferNative}
            onChange={(v) => patch({ preferNative: v })}
            label="Prefer silent ESC/POS printing"
            hint="Falls back to the print dialog if hardware printing fails."
          />
          <ToggleRow
            checked={config.openCashDrawer}
            onChange={(v) => patch({ openCashDrawer: v })}
            label="Open cash drawer after print"
            hint="Sends an ESC/POS drawer pulse with the receipt."
          />

          <Separator className="my-2" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="copies">Copies</Label>
              <Input
                id="copies"
                type="number"
                min={1}
                max={5}
                value={config.copies}
                onChange={(e) => patch({ copies: Number(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Paper width override</Label>
              <Select
                value={config.paperWidthMm == null ? "template" : String(config.paperWidthMm)}
                onValueChange={(v) =>
                  patch({
                    paperWidthMm: v === "template" ? null : (Number(v) as 58 | 80),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="template">Use receipt template</SelectItem>
                  <SelectItem value="58">58 mm</SelectItem>
                  <SelectItem value="80">80 mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Hardware connection</CardTitle>
          <CardDescription>Choose how this terminal talks to the thermal printer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {discovered.length > 0 ? (
            <div className="space-y-2">
              <Label>Discovered on this terminal</Label>
              <ul className="border-border divide-y rounded-md border text-sm">
                {discovered.map((printer) => (
                  <li
                    key={printer.name}
                    className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {printer.name}
                        {printer.isDefault ? (
                          <span className="text-muted-foreground ml-2 text-xs font-normal">
                            (default)
                          </span>
                        ) : null}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {printer.driverName || "Unknown driver"}
                        {printer.portName ? ` · ${printer.portName}` : ""}
                        {printer.networkHost
                          ? ` · ${printer.networkHost}:${printer.networkPort ?? 9100}`
                          : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => applyDiscovered(printer)}
                    >
                      Use this printer
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Connection type</Label>
            <Select
              value={config.connectionType}
              onValueChange={(v) =>
                patch({ connectionType: v as TerminalPrinterConfig["connectionType"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (network, then installed printer)</SelectItem>
                <SelectItem value="network">Network (TCP :9100)</SelectItem>
                <SelectItem value="windows">Installed printer name</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showNetworkFields ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="printer-host">Printer host / IP</Label>
                <Input
                  id="printer-host"
                  value={config.printerHost}
                  onChange={(e) => patch({ printerHost: e.target.value })}
                  placeholder="192.168.1.50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="printer-port">TCP port</Label>
                <Input
                  id="printer-port"
                  type="number"
                  value={config.printerPort}
                  onChange={(e) => patch({ printerPort: Number(e.target.value) || 9100 })}
                />
              </div>
            </div>
          ) : null}

          {showWindowsField ? (
            <div className="space-y-2">
              <Label htmlFor="windows-printer">Installed printer name</Label>
              {discovered.length > 0 ? (
                <Select
                  value={config.windowsPrinterName || undefined}
                  onValueChange={(v) => {
                    const match = discovered.find((p) => p.name === v);
                    if (match) applyDiscovered(match);
                    else patch({ windowsPrinterName: v, connectionType: "windows" });
                  }}
                >
                  <SelectTrigger id="windows-printer">
                    <SelectValue placeholder="Select a discovered printer" />
                  </SelectTrigger>
                  <SelectContent>
                    {discovered.map((p) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.name}
                        {p.isDefault ? " (default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="windows-printer"
                  value={config.windowsPrinterName}
                  onChange={(e) => patch({ windowsPrinterName: e.target.value })}
                  placeholder="EPSON TM-T20II — or Discover printers"
                />
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => void onSave()}>
          {pending ? "Saving…" : "Save printer settings"}
        </Button>
      </div>
    </div>
  );
}

function RuntimeBadge({ bridge }: { bridge: BridgeSnapshot }) {
  if (bridge.state === "unknown") {
    return <Badge variant="secondary">Checking…</Badge>;
  }
  if (bridge.state === "offline") {
    return <Badge variant="destructive">Bridge offline</Badge>;
  }
  return (
    <Badge variant="success" className="gap-1">
      <Monitor className="h-3 w-3" />
      {formatOperatingSystem(bridge.platform)}
      {bridge.version ? ` · v${bridge.version}` : ""}
    </Badge>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "border-border flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? (
          <span className="text-muted-foreground block text-xs leading-relaxed">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}
