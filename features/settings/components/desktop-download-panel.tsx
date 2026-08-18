"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useQuery } from "convex/react";
import { Download, Monitor } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingState } from "@/components/feedback/loading-state";
import { APP_NAME } from "@/constants/app";
import { detectBrowserDesktopTarget, type BrowserDesktopTarget } from "@/lib/desktop";
import { cn } from "@/lib/utils";

/** Cached once — UA does not change; stable reference for useSyncExternalStore. */
let cachedBrowserTarget: BrowserDesktopTarget | null | undefined;

function subscribeNoop() {
  return () => {};
}

function getBrowserTargetSnapshot(): BrowserDesktopTarget | null {
  if (cachedBrowserTarget === undefined) {
    cachedBrowserTarget = detectBrowserDesktopTarget();
  }
  return cachedBrowserTarget;
}

function formatBytes(size?: number) {
  if (size == null || size <= 0) return null;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatReleasedAt(timestamp: number | undefined) {
  if (!timestamp) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(timestamp));
}

type InstallerKind = "windows" | "macos" | "linux-deb" | "linux-appimage";

function isSuggested(
  kind: InstallerKind,
  platform: "win32" | "darwin" | "linux",
  target: BrowserDesktopTarget | null,
): boolean {
  if (!target) return false;
  if (target.platform !== platform) return false;
  // On Linux, prefer Debian when the UA looks Debian-like; otherwise AppImage.
  if (platform === "linux") {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const looksDebian = /Ubuntu|Debian|Linux Mint/i.test(ua);
    return kind === (looksDebian ? "linux-deb" : "linux-appimage");
  }
  return true;
}

/** Web-only: pick Windows / macOS / Linux installers from the Convex release feed. */
export function DesktopDownloadPanel() {
  const target = useSyncExternalStore(subscribeNoop, getBrowserTargetSnapshot, () => null);
  const preferredArch = target?.arch ?? "x64";
  const offer = useQuery(api.desktopReleases.getInstallOffer, {
    preferredArch,
    channel: "stable",
  });

  const installers = useMemo(() => offer?.installers ?? [], [offer]);
  const releasedLabel = formatReleasedAt(offer?.releasedAt);

  if (offer === undefined) {
    return <LoadingState label="Loading desktop downloads…" variant="form" />;
  }

  if (offer === null || installers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Desktop app</CardTitle>
          <CardDescription>
            Download {APP_NAME} for Windows, macOS, or Linux when a release is published.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Monitor className="size-4" />
            <AlertTitle>No installers available</AlertTitle>
            <AlertDescription>
              A desktop release hasn&apos;t been published to this environment yet. Try again after
              the next desktop release, or ask an administrator.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Desktop app</CardTitle>
              <CardDescription>
                Download the native app for offline reliability, receipt printing, and faster
                checkout. Choose your operating system below.
              </CardDescription>
            </div>
            <Badge variant="secondary">v{offer.version}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {releasedLabel ? (
            <p className="text-muted-foreground text-xs">Released {releasedLabel}</p>
          ) : null}

          <ul className="space-y-3">
            {installers.map((installer) => {
              const suggested = installer.platform
                ? isSuggested(installer.kind as InstallerKind, installer.platform, target)
                : false;
              const sizeLabel = formatBytes(installer.size);

              return (
                <li
                  key={installer.kind}
                  className={cn(
                    "border-border flex flex-col gap-3 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between",
                    suggested && "border-primary/40 bg-primary/5",
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{installer.label}</p>
                      {suggested ? (
                        <Badge variant="outline" className="text-xs">
                          Suggested for this device
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {installer.description}
                      {sizeLabel ? ` · ${sizeLabel}` : ""}
                      {installer.arch ? ` · ${installer.arch}` : ""}
                    </p>
                    <p className="text-muted-foreground truncate font-mono text-[11px]">
                      {installer.fileName}
                    </p>
                  </div>
                  <Button asChild className="shrink-0" size="sm">
                    <a href={installer.url} download>
                      <Download className="mr-2 size-4" aria-hidden />
                      Download
                    </a>
                  </Button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
