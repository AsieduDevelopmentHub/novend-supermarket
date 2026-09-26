"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { getDesktopBridge } from "@/lib/desktop";
import type { NovendDesktopUpdateStatus } from "@/types/desktop";
import { sanitizeReleaseNoteLines } from "@/lib/sanitize-release-notes";
import { useConnectivity } from "@/hooks/use-connectivity";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { Download, Loader2, RefreshCw, Rocket, WifiOff } from "lucide-react";

const EMPTY_STATUS: NovendDesktopUpdateStatus = {
  state: "idle",
  currentVersion: "—",
  availableVersion: null,
  releaseNotes: null,
  progressPercent: null,
  errorMessage: null,
  lastCheckedAt: null,
  packaged: false,
  feedConfigured: false,
  canCheck: false,
  canInstall: false,
};

function formatCheckedAt(timestamp: number | null): string {
  if (!timestamp) return "Not checked yet";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function statusLabel(status: NovendDesktopUpdateStatus): string {
  switch (status.state) {
    case "checking":
      return "Checking for updates…";
    case "up-to-date":
      return "You're up to date";
    case "available":
      return status.availableVersion
        ? `Update ${status.availableVersion} available`
        : "Update available";
    case "downloading":
      return status.availableVersion
        ? `Downloading ${status.availableVersion}…`
        : "Downloading update…";
    case "ready":
      return status.availableVersion
        ? `Version ${status.availableVersion} ready to install`
        : "Update ready to install";
    case "error":
      return "Update check failed";
    case "disabled":
      return "Updates unavailable";
    default:
      return "Waiting for first check";
  }
}

function statusBadge(status: NovendDesktopUpdateStatus): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  switch (status.state) {
    case "up-to-date":
      return { label: "Current", variant: "secondary" };
    case "ready":
      return { label: "Ready", variant: "default" };
    case "downloading":
    case "checking":
    case "available":
      return { label: "Update", variant: "outline" };
    case "error":
    case "disabled":
      return { label: "Unavailable", variant: "destructive" };
    default:
      return { label: "Idle", variant: "outline" };
  }
}

/** Desktop-only: check, review, and install Electron updates from Settings. */
export function UpdatesPanel() {
  const online = useConnectivity();
  const [status, setStatus] = useState<NovendDesktopUpdateStatus>(EMPTY_STATUS);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const bridge = getDesktopBridge();
    if (!bridge?.getUpdateStatus) return;

    let cancelled = false;
    void bridge.getUpdateStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });

    const unsubscribe = bridge.onUpdateStatus?.((next) => {
      if (!cancelled) setStatus(next);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  async function onCheck() {
    if (!online) {
      toast.message("Reconnect to check for desktop updates");
      return;
    }
    const bridge = getDesktopBridge();
    if (!bridge?.checkForUpdates) {
      toast.error("Update bridge unavailable. Restart the desktop app and try again.");
      return;
    }

    setChecking(true);
    try {
      const next = await bridge.checkForUpdates();
      setStatus(next);
      if (next.state === "up-to-date") {
        toast.success("You're on the latest version");
      } else if (next.state === "ready") {
        toast.success(`Version ${next.availableVersion ?? ""} is ready to install`);
      } else if (next.state === "available" || next.state === "downloading") {
        toast.message(
          next.availableVersion
            ? `Update ${next.availableVersion} found`
            : "Update found — downloading…",
        );
      } else if (next.state === "error" || next.state === "disabled") {
        toast.error(next.errorMessage || "Could not check for updates");
      }
    } catch (error) {
      showError(error, "Could not check for updates");
    } finally {
      setChecking(false);
    }
  }

  async function onInstall() {
    if (!online) {
      toast.message("Reconnect to download and install updates");
      return;
    }
    const bridge = getDesktopBridge();
    if (!bridge?.installUpdate) {
      toast.error("Update bridge unavailable. Restart the desktop app and try again.");
      return;
    }

    setInstalling(true);
    try {
      const result = await bridge.installUpdate();
      if (!result.ok) {
        toast.error(result.message);
        setInstalling(false);
        return;
      }
      toast.message(result.message);
    } catch (error) {
      setInstalling(false);
      showError(error, "Could not install update");
    }
  }

  const badge = statusBadge(status);
  const busy = checking || status.state === "checking" || status.state === "downloading";
  const showProgress =
    status.state === "downloading" &&
    typeof status.progressPercent === "number" &&
    Number.isFinite(status.progressPercent);
  const releaseHighlights = sanitizeReleaseNoteLines(status.releaseNotes);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle>Desktop updates</CardTitle>
            <CardDescription>
              Check for a newer desktop build and install it when you&apos;re ready. Finish any open
              sale before restarting.
            </CardDescription>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          {!online ? (
            <Alert>
              <WifiOff className="h-4 w-4" aria-hidden />
              <AlertTitle>Offline</AlertTitle>
              <AlertDescription>
                Update checks and downloads need an internet connection. Installed version details
                below are still available.
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border-border rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Installed
              </p>
              <p className="mt-1 text-sm font-medium">v{status.currentVersion}</p>
            </div>
            <div className="border-border rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Latest found
              </p>
              <p className="mt-1 text-sm font-medium">
                {status.availableVersion ? `v${status.availableVersion}` : "—"}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">{statusLabel(status)}</p>
            <p className="text-muted-foreground text-xs">
              Last checked: {formatCheckedAt(status.lastCheckedAt)}
            </p>
          </div>

          {showProgress ? (
            <div className="space-y-2">
              <Progress value={status.progressPercent ?? 0} />
              <p className="text-muted-foreground text-xs">{status.progressPercent}% downloaded</p>
            </div>
          ) : null}

          {releaseHighlights.length > 0 ? (
            <div className="border-border bg-muted/30 rounded-lg border px-3 py-2">
              <p className="mb-1 text-xs font-medium tracking-wide uppercase">What&apos;s new</p>
              <ul className="text-muted-foreground space-y-1.5 text-sm">
                {releaseHighlights.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="bg-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {status.state === "disabled" || status.state === "error" ? (
            <Alert variant={status.state === "error" ? "destructive" : "default"}>
              <AlertTitle>
                {status.state === "disabled" ? "Updates unavailable" : "Something went wrong"}
              </AlertTitle>
              <AlertDescription>
                {status.errorMessage ||
                  (status.packaged
                    ? "This install cannot reach the update feed."
                    : "Packaged desktop installs receive updates. Development mode does not.")}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void onCheck()}
              disabled={busy || !status.canCheck || !online}
              title={!online ? "Needs a connection" : undefined}
            >
              {busy ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="mr-2 size-4" aria-hidden />
              )}
              Check for updates
            </Button>

            <Button
              type="button"
              onClick={() => void onInstall()}
              disabled={!status.canInstall || installing || !online}
              title={!online ? "Needs a connection" : undefined}
            >
              {installing ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : status.state === "ready" ? (
                <Rocket className="mr-2 size-4" aria-hidden />
              ) : (
                <Download className="mr-2 size-4" aria-hidden />
              )}
              Restart &amp; install
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
