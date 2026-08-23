"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Hardware, getPlatform, type AppInfo } from "@novend/hardware";
import { useOfflineStatus } from "@/providers/offline-provider";
import { usePermissions } from "@/hooks/use-permissions";
import { loadShellProfile } from "@/lib/offline/shell-profile";
import { estimateBackupSize } from "@/lib/offline/backup";
import { APP_BRAND } from "@/constants/app";
import { Info } from "lucide-react";

export function AboutNovendView() {
  const { role, branchName } = usePermissions();
  const offline = useOfflineStatus();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [storageLabel, setStorageLabel] = useState<string>("Calculating…");

  useEffect(() => {
    void (async () => {
      const app = await Hardware.app.getInfo();
      if (app.data) setInfo(app.data);
      const profile = await loadShellProfile();
      setOrgName(profile?.organizationName ?? null);
      try {
        const bytes = await estimateBackupSize();
        const mb = bytes / (1024 * 1024);
        setStorageLabel(mb < 0.1 ? `${Math.round(bytes / 1024)} KB` : `${mb.toFixed(1)} MB`);
      } catch {
        setStorageLabel("Unavailable");
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">About {APP_BRAND}</h1>
        <p className="text-muted-foreground mt-1 text-sm">Device and build details for support.</p>
      </div>

      <Card className="rounded-[20px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4" />
            Application
          </CardTitle>
          <CardDescription>
            Version {info?.version ?? "—"} · Build {info?.build ?? "—"}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>Platform: {getPlatform()}</p>
          <p>Package: {info?.id ?? "—"}</p>
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
            <Link href="/privacy">Privacy Policy</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 justify-start">
            <Link href="/terms">Terms of Service</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 justify-start">
            <Link href="/docs/help">Help & support</Link>
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
