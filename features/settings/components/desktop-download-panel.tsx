"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Download, Monitor } from "lucide-react";
import { useReleaseOffers } from "@/hooks/use-release-offers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingState } from "@/components/feedback/loading-state";
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

function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/** Web + desktop: pick Windows / macOS / Linux installers and the Android APK. */
export function DesktopDownloadPanel() {
  const target = useSyncExternalStore(subscribeNoop, getBrowserTargetSnapshot, () => null);
  const preferredArch = target?.arch ?? "x64";
  const { desktop: offer, mobile: mobileOffer } = useReleaseOffers(preferredArch);

  const installers = useMemo(() => offer?.installers ?? [], [offer]);
  const releasedLabel = formatReleasedAt(offer?.releasedAt);
  const mobileReleasedLabel = formatReleasedAt(mobileOffer?.releasedAt);
  const android = mobileOffer?.downloads.android;
  const androidStore = mobileOffer?.storeUrls.android;
  const ios = mobileOffer?.downloads.ios;
  const iosStore = mobileOffer?.storeUrls.ios;
  const androidSuggested = isAndroidDevice();

  if (offer === undefined || mobileOffer === undefined) {
    return <LoadingState label="Loading app downloads…" variant="form" />;
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
                checkout. Also on the{" "}
                <a href="/download" className="text-primary font-medium hover:underline">
                  public download page
                </a>
                .
              </CardDescription>
            </div>
            {offer ? <Badge variant="secondary">v{offer.version}</Badge> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {offer === null || installers.length === 0 ? (
            <Alert>
              <Monitor className="size-4" />
              <AlertTitle>No desktop installers yet</AlertTitle>
              <AlertDescription>
                A desktop release hasn&apos;t been published to this environment yet. Try again
                after the next release, or ask an administrator.
              </AlertDescription>
            </Alert>
          ) : (
            <>
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
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Mobile app</CardTitle>
              <CardDescription>
                Download the Android app for phones and tablets. On iPhone and iPad, add Novend to
                your Home Screen as a PWA. Same account, catalog, and sync as desktop and web.
              </CardDescription>
            </div>
            {mobileOffer ? <Badge variant="secondary">v{mobileOffer.version}</Badge> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {mobileReleasedLabel ? (
            <p className="text-muted-foreground text-xs">Released {mobileReleasedLabel}</p>
          ) : null}

          <ul className="space-y-3">
            <li
              className={cn(
                "border-border flex flex-col gap-3 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between",
                android && androidSuggested && "border-primary/40 bg-primary/5",
              )}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">Android</p>
                  {android && androidSuggested ? (
                    <Badge variant="outline" className="text-xs">
                      Suggested for this device
                    </Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Native app for phones and tablets
                  {android ? ` · ${formatBytes(android.size) ?? "APK"}` : ""}
                </p>
                {android ? (
                  <p className="text-muted-foreground truncate font-mono text-[11px]">
                    {android.fileName}
                  </p>
                ) : null}
              </div>
              {android?.url ? (
                <Button asChild className="shrink-0" size="sm">
                  <a href={android.url} download={android.fileName}>
                    <Download className="mr-2 size-4" aria-hidden />
                    Download APK
                  </a>
                </Button>
              ) : androidStore ? (
                <Button asChild className="shrink-0" size="sm" variant="outline">
                  <a href={androidStore} target="_blank" rel="noopener noreferrer">
                    Open in store
                  </a>
                </Button>
              ) : (
                <Badge variant="outline" className="w-fit text-xs">
                  Coming soon
                </Badge>
              )}
            </li>
            <li className="border-border flex flex-col gap-3 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">iPhone &amp; iPad</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {ios || iosStore
                    ? `Native app for Apple devices${ios ? ` · ${formatBytes(ios.size) ?? "IPA"}` : ""}`
                    : "Add Novend to your Home Screen from Safari as a PWA"}
                </p>
              </div>
              {ios?.url ? (
                <Button asChild className="shrink-0" size="sm">
                  <a href={ios.url} download={ios.fileName}>
                    <Download className="mr-2 size-4" aria-hidden />
                    Download
                  </a>
                </Button>
              ) : iosStore ? (
                <Button asChild className="shrink-0" size="sm" variant="outline">
                  <a href={iosStore} target="_blank" rel="noopener noreferrer">
                    Open in store
                  </a>
                </Button>
              ) : (
                <Badge variant="secondary" className="w-fit text-xs">
                  PWA
                </Badge>
              )}
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
