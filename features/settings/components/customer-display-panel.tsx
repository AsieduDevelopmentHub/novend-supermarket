"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDesktopBridge } from "@/lib/desktop";
import { useDesktopRuntime } from "@/hooks/use-desktop-runtime";
import {
  readCustomerDisplayPrefs,
  writeCustomerDisplayPrefs,
  type CustomerDisplayPrefs,
} from "@/lib/sales/customer-display";
import type {
  NovendDesktopCustomerDisplayStatus,
  NovendDesktopDisplayInfo,
} from "@/types/desktop";
import { PlanCapabilityGate } from "@/features/billing/components/plan-capability-gate";
import { showError } from "@/lib/errors";
import { toast } from "sonner";
import { ExternalLink, Loader2, Monitor, Tv, X } from "lucide-react";

function desktopSupportsCustomerDisplay(
  bridge: ReturnType<typeof getDesktopBridge>,
): bridge is NonNullable<ReturnType<typeof getDesktopBridge>> & {
  getCustomerDisplayStatus: () => Promise<NovendDesktopCustomerDisplayStatus>;
  openCustomerDisplay: (options?: { displayId?: number | null }) => Promise<{ ok: boolean; message?: string }>;
  closeCustomerDisplay: () => Promise<{ ok: boolean }>;
  listDisplays: () => Promise<{ ok: boolean; displays: NovendDesktopDisplayInfo[] }>;
} {
  return Boolean(
    bridge &&
      typeof bridge.getCustomerDisplayStatus === "function" &&
      typeof bridge.openCustomerDisplay === "function" &&
      typeof bridge.closeCustomerDisplay === "function" &&
      typeof bridge.listDisplays === "function",
  );
}

export function CustomerDisplayPanel() {
  const isDesktop = useDesktopRuntime();
  const [prefs, setPrefs] = useState<CustomerDisplayPrefs>(() => readCustomerDisplayPrefs());
  const [status, setStatus] = useState<NovendDesktopCustomerDisplayStatus>({
    open: false,
    displayId: null,
  });
  const [displays, setDisplays] = useState<NovendDesktopDisplayInfo[]>([]);
  const [pending, setPending] = useState(false);
  const [capabilityAvailable, setCapabilityAvailable] = useState<boolean | null>(null);
  const [desktopBridgeStale, setDesktopBridgeStale] = useState(false);

  useEffect(() => {
    writeCustomerDisplayPrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    const bridge = getDesktopBridge();
    if (!bridge) {
      setCapabilityAvailable(null);
      setDesktopBridgeStale(false);
      return;
    }

    if (!desktopSupportsCustomerDisplay(bridge)) {
      setCapabilityAvailable(null);
      setDesktopBridgeStale(true);
      return;
    }

    setDesktopBridgeStale(false);

    void bridge.getCapabilities().then((result) => {
      const row = result.capabilities.find((cap) => cap.kind === "customer_display");
      setCapabilityAvailable(row?.available ?? false);
    });
    void bridge.getCustomerDisplayStatus().then(setStatus);
    void bridge.listDisplays().then((result) => {
      if (result.ok) setDisplays(result.displays);
    });

    return bridge.onCustomerDisplayStatus?.(setStatus);
  }, [isDesktop]);

  async function openDisplay() {
    setPending(true);
    try {
      const bridge = getDesktopBridge();
      if (desktopSupportsCustomerDisplay(bridge)) {
        const result = await bridge.openCustomerDisplay({
          displayId: prefs.preferredDisplayId,
        });
        if (!result.ok) {
          toast.error(result.message ?? "Could not open customer display");
          return;
        }
        toast.success("Customer display opened");
        setStatus(await bridge.getCustomerDisplayStatus());
        return;
      }

      const popup = window.open(
        "/customer-display",
        "novend-customer-display",
        "noopener,noreferrer,width=1280,height=800",
      );
      if (!popup) {
        toast.error("Allow pop-ups for this site, then try again.");
        return;
      }
      toast.success("Customer display opened — drag the window to your second monitor.");
    } catch (error) {
      showError(error, "Could not open customer display");
    } finally {
      setPending(false);
    }
  }

  async function closeDisplay() {
    setPending(true);
    try {
      const bridge = getDesktopBridge();
      if (desktopSupportsCustomerDisplay(bridge)) {
        await bridge.closeCustomerDisplay();
        setStatus(await bridge.getCustomerDisplayStatus());
        toast.success("Customer display closed");
      }
    } catch (error) {
      showError(error, "Could not close customer display");
    } finally {
      setPending(false);
    }
  }

  return (
    <PlanCapabilityGate
      capability="canUseCustomerDisplay"
      title="Customer display"
      description="Show cart items, discounts, and totals on a customer-facing screen."
    >
      <CustomerDisplayPanelContent
        isDesktop={isDesktop}
        prefs={prefs}
        setPrefs={setPrefs}
        status={status}
        displays={displays}
        pending={pending}
        capabilityAvailable={capabilityAvailable}
        onOpen={() => void openDisplay()}
        onClose={() => void closeDisplay()}
        desktopBridgeStale={desktopBridgeStale}
      />
    </PlanCapabilityGate>
  );
}

function CustomerDisplayPanelContent({
  isDesktop,
  prefs,
  setPrefs,
  status,
  displays,
  pending,
  capabilityAvailable,
  onOpen,
  onClose,
  desktopBridgeStale,
}: {
  isDesktop: boolean;
  prefs: CustomerDisplayPrefs;
  setPrefs: Dispatch<SetStateAction<CustomerDisplayPrefs>>;
  status: NovendDesktopCustomerDisplayStatus;
  displays: NovendDesktopDisplayInfo[];
  pending: boolean;
  capabilityAvailable: boolean | null;
  onOpen: () => void;
  onClose: () => void;
  desktopBridgeStale: boolean;
}) {
  return (
    <div className="space-y-4">
      {desktopBridgeStale ? (
        <Alert variant="destructive">
          <AlertTitle>Desktop app update required</AlertTitle>
          <AlertDescription>
            Customer display needs Novend POS desktop v0.3.18 or newer. Open Settings → This device
            → Updates, install the latest release, then restart the app.
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tv className="h-4 w-4" aria-hidden />
            Customer display
          </CardTitle>
          <CardDescription>
            Show cart items, discounts, and totals on a customer-facing screen. Updates in real
            time from the Sales screen — no network required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status.open ? "default" : "outline"}>
              {status.open ? "Open" : "Closed"}
            </Badge>
            {isDesktop && capabilityAvailable === true ? (
              <Badge variant="outline" className="border-success/30 text-success">
                Hardware ready
              </Badge>
            ) : null}
            {isDesktop ? (
              <Badge variant="outline">Electron · multi-monitor</Badge>
            ) : (
              <Badge variant="outline">Browser · pop-up window</Badge>
            )}
          </div>

          {isDesktop && displays.length > 1 ? (
            <div className="space-y-2">
              <Label htmlFor="customer-display-monitor">Target monitor</Label>
              <Select
                value={
                  prefs.preferredDisplayId != null
                    ? String(prefs.preferredDisplayId)
                    : "secondary"
                }
                onValueChange={(value) => {
                  if (value === "secondary") {
                    setPrefs((prev) => ({ ...prev, preferredDisplayId: null }));
                    return;
                  }
                  setPrefs((prev) => ({
                    ...prev,
                    preferredDisplayId: Number(value),
                  }));
                }}
              >
                <SelectTrigger id="customer-display-monitor" className="w-full max-w-md">
                  <SelectValue placeholder="Choose a monitor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="secondary">Secondary display (recommended)</SelectItem>
                  {displays.map((display) => (
                    <SelectItem key={display.id} value={String(display.id)}>
                      {display.label}
                      {display.isPrimary ? " · Primary" : ""} · {display.workArea.width}×
                      {display.workArea.height}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {isDesktop ? (
            <label className="flex items-start gap-3">
              <Checkbox
                checked={prefs.autoOpen}
                onCheckedChange={(checked) =>
                  setPrefs((prev) => ({ ...prev, autoOpen: checked === true }))
                }
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium">Open automatically on launch</span>
                <span className="text-muted-foreground block text-sm">
                  Opens the customer display when you sign in on this terminal.
                </span>
              </span>
            </label>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onOpen} disabled={pending || desktopBridgeStale}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Monitor className="mr-2 h-4 w-4" />}
              Open customer display
            </Button>
            {isDesktop && status.open ? (
              <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                <X className="mr-2 h-4 w-4" />
                Close
              </Button>
            ) : null}
            {!isDesktop ? (
              <Button type="button" variant="outline" asChild>
                <a href="/customer-display" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in new tab
                </a>
              </Button>
            ) : null}
          </div>

          {!isDesktop ? (
            <Alert>
              <AlertTitle>Desktop web workaround</AlertTitle>
              <AlertDescription>
                Browsers cannot place windows on a specific monitor. Open the customer display in a
                second window, then drag it to your external display. Cart updates sync instantly on
                the same device.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
