"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/primitives";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Hardware,
  getPlatform,
  isCapacitor,
  type AppInfo,
  type UpdateInfo,
} from "@novend/hardware";
import { useOfflineStatus } from "@/providers/offline-provider";
import { usePermissions } from "@/hooks/use-permissions";
import { loadShellProfile } from "@/lib/offline/shell-profile";
import { estimateBackupSize } from "@/lib/offline/backup";
import { APP_BRAND, APP_NAME, APP_VERSION } from "@/constants/app";
import { describeUpdateCheck } from "@/lib/native/update-check";
import { Info } from "lucide-react";

const LAST_UPDATE_KEY = "novend.mobileUpdate.last";

function readCachedUpdate(): UpdateInfo | null {
  try {
    const raw = window.localStorage.getItem(LAST_UPDATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UpdateInfo;
  } catch {
    return null;
  }
}

function cacheSuccessfulUpdate(info: UpdateInfo) {
  if (info.status !== "available" && info.status !== "latest") return;
  try {
    window.localStorage.setItem(LAST_UPDATE_KEY, JSON.stringify(info));
  } catch {
    /* private mode */
  }
}

export function AboutNovendView() {
  const { role, branchName } = usePermissions();
  const offline = useOfflineStatus();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [storageLabel, setStorageLabel] = useState<string>("Calculating…");

  useEffect(() => {
    if (isCapacitor()) setUpdate(readCachedUpdate());
    void (async () => {
      const [app, profile] = await Promise.all([Hardware.app.getInfo(), loadShellProfile()]);
      if (app.data) setInfo(app.data);
      setOrgName(profile?.organizationName ?? null);
      if (isCapacitor()) {
        setUpdateChecking(true);
        try {
          const checked = await Hardware.app.checkForUpdate();
          const next = checked.data ?? { available: false, status: "unknown" as const };
          if (checked.ok && (next.status === "available" || next.status === "latest")) {
            cacheSuccessfulUpdate(next);
            setUpdate(next);
          } else {
            setUpdate((current) => current ?? next);
          }
        } finally {
          setUpdateChecking(false);
        }
      }
      try {
        const bytes = await estimateBackupSize();
        const mb = bytes / (1024 * 1024);
        setStorageLabel(mb < 0.1 ? `${Math.round(bytes / 1024)} KB` : `${mb.toFixed(1)} MB`);
      } catch {
        setStorageLabel("Unavailable");
      }
    })();
  }, []);

  const shellVersion = info?.version?.trim() || null;
  const shellBuild = info?.build?.trim() || null;
  const platform = getPlatform();
  const displayVersion = shellVersion || APP_VERSION;
  const versionsMatch =
    !shellVersion || shellVersion === APP_VERSION || shellVersion.replace(/^v/, "") === APP_VERSION;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader
        title={`About ${APP_BRAND}`}
        description="Device and build details for support."
      />

      <Card className="rounded-[20px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4" />
            Application
          </CardTitle>
          <CardDescription>
            {APP_NAME} · v{displayVersion}
            {shellBuild ? ` · build ${shellBuild}` : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            App version: <span className="text-foreground font-medium">v{APP_VERSION}</span>
          </p>
          <p>
            Native shell:{" "}
            <span className="text-foreground font-medium">
              {shellVersion ? `v${shellVersion}` : "Web / browser"}
              {shellBuild ? ` (${shellBuild})` : ""}
            </span>
          </p>
          {!versionsMatch ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Shell build differs from the hosted app version — update this app when a newer release
              is available.
            </p>
          ) : null}
          <p>Platform: {platform}</p>
          <p>Package: {info?.id ?? "com.novend.pos"}</p>
          {isCapacitor() ? (
            <p>
              Update check:{" "}
              <span className="text-foreground font-medium">
                {describeUpdateCheck({
                  checking: updateChecking,
                  online: offline.online,
                  update,
                })}
              </span>
            </p>
          ) : null}
          <p>Organization: {orgName || "—"}</p>
          <p>Branch: {branchName || "—"}</p>
          <p>Role: {role || "—"}</p>
          <p>Offline storage: {storageLabel}</p>
          <p>
            Sync:{" "}
            {offline.online
              ? offline.pendingCount > 0
                ? `${offline.pendingCount} pending`
                : "Up to date"
              : "Offline"}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-[20px]">
        <CardHeader>
          <CardTitle className="text-base">Legal & support</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button asChild variant="outline" className="min-h-11 justify-start">
            <a href="/privacy">Privacy Policy</a>
          </Button>
          <Button asChild variant="outline" className="min-h-11 justify-start">
            <a href="/terms">Terms of Service</a>
          </Button>
          <Button asChild variant="outline" className="min-h-11 justify-start">
            <Link href="/settings?section=help">Help &amp; tours</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 justify-start">
            <a href="/docs/help">Help & support</a>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 justify-start"
            onClick={() => void Hardware.app.openExternalUrl("mailto:asiedudev.hub@gmail.com")}
          >
            Contact support
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
