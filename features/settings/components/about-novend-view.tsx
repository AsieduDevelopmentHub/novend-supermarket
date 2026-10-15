"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/primitives";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Hardware, isCapacitor, type AppInfo, type UpdateInfo } from "@novend/hardware";
import { useOfflineStatus } from "@/providers/offline-provider";
import { usePermissions } from "@/hooks/use-permissions";
import { useShowsRealtimeSyncUi } from "@/hooks/use-shows-realtime-sync-ui";
import { loadShellProfile } from "@/lib/offline/shell-profile";
import { estimateBackupSize } from "@/lib/offline/backup";
import {
  APP_NAME,
  APP_VERSION,
  NOVEND_CONTACT_EMAIL,
  NOVEND_CONTACT_SITE,
  NOVEND_LOCAL_CONTACT,
  RECEIPT_VENDOR_FOOTER,
} from "@/constants/app";
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
  const { role } = usePermissions();
  const offline = useOfflineStatus();
  const showRealtimeSync = useShowsRealtimeSyncUi();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [storageLabel, setStorageLabel] = useState<string>("Calculating…");

  useEffect(() => {
    if (isCapacitor()) {
      queueMicrotask(() => setUpdate(readCachedUpdate()));
    }
    void (async () => {
      const [app, profile] = await Promise.all([Hardware.app.getInfo(), loadShellProfile()]);
      if (app.data) setInfo(app.data);
      setOrgName(profile?.organizationName ?? null);
      if (isCapacitor()) {
        try {
          const checked = await Hardware.app.checkForUpdate();
          const next = checked.data ?? { available: false, status: "unknown" as const };
          if (checked.ok && (next.status === "available" || next.status === "latest")) {
            cacheSuccessfulUpdate(next);
            setUpdate(next);
          } else {
            setUpdate((current) => current ?? next);
          }
        } catch {
          /* ignore update probe failures */
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
  const displayVersion = shellVersion || APP_VERSION;
  const versionsMatch =
    !shellVersion || shellVersion === APP_VERSION || shellVersion.replace(/^v/, "") === APP_VERSION;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader title={`About ${APP_NAME}`} />

      <Card className="rounded-[20px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4" />
            Application
          </CardTitle>
          <CardDescription>
            {APP_NAME} · v{displayVersion}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            Version: <span className="text-foreground font-medium">v{APP_VERSION}</span>
          </p>
          {!versionsMatch && shellVersion ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              An update is available for this device.
            </p>
          ) : null}
          {orgName ? (
            <p>
              Store: <span className="text-foreground font-medium">{orgName}</span>
            </p>
          ) : null}
          {role ? (
            <p>
              Role: <span className="text-foreground font-medium capitalize">{role}</span>
            </p>
          ) : null}
          <p>
            Local storage: <span className="text-foreground font-medium">{storageLabel}</span>
          </p>
          <p>
            Sync:{" "}
            <span className="text-foreground font-medium">
              {!showRealtimeSync
                ? "On this device"
                : offline.online
                  ? offline.pendingCount > 0
                    ? `${offline.pendingCount} pending`
                    : "Up to date"
                  : "Offline"}
            </span>
          </p>
          <p className="text-foreground pt-2 font-medium">{RECEIPT_VENDOR_FOOTER}</p>
          <p className="text-muted-foreground text-xs">
            {NOVEND_LOCAL_CONTACT} · {NOVEND_CONTACT_EMAIL} ·{" "}
            <a
              href={NOVEND_CONTACT_SITE}
              className="text-primary underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              novendpos.app
            </a>
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-[20px]">
        <CardHeader>
          <CardTitle className="text-base">Help</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button asChild variant="outline" className="min-h-11 justify-start">
            <Link href="/settings?section=help">Help &amp; tours</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 justify-start">
            <Link href="/settings?section=license">License</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
