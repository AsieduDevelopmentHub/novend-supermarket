"use client";

import Link from "next/link";
import { ChevronRight, Download, Package } from "lucide-react";
import { PageHeader } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDateTime } from "@/lib/date";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePlatformReleasesData } from "@/hooks/use-platform-offline-data";

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PlatformReleasesView() {
  const online = useConnectivity();
  const { data: releases, loading } = usePlatformReleasesData("stable");

  if (loading || !releases) {
    return <LoadingState label="Loading desktop releases…" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Downloads"
        description="Published installers available for download. Release metadata is cached offline; downloading packages still needs a connection."
      />

      {!online ? (
        <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-sm">
          Showing cached release list while offline.
        </p>
      ) : null}

      {releases.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No releases yet"
          description="After the next version is published, installers and notes will appear here automatically for download."
        />
      ) : (
        releases.map((release) => (
          <Card key={release._id} className="overflow-hidden">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                  {release.tag}
                  <Badge variant="secondary">{release.version}</Badge>
                  <Badge variant="outline">{release.channel}</Badge>
                  {release.mandatory ? <Badge variant="warning">Mandatory</Badge> : null}
                </CardTitle>
                <p className="text-muted-foreground mt-1 text-sm">
                  Published {formatDateTime(release.releasedAt)}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/platform/releases/${encodeURIComponent(release.version)}`}>
                  Details
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {release.notes ? (
                <pre className="bg-muted/40 text-muted-foreground max-h-40 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
                  {release.notes}
                </pre>
              ) : null}
              {release.assets.length === 0 ? (
                <p className="text-muted-foreground text-sm">No installer assets on this release.</p>
              ) : (
                <ul className="space-y-2">
                  {release.assets.slice(0, 3).map((asset) => (
                    <li
                      key={asset.githubAssetId}
                      className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{asset.fileName}</p>
                        <p className="text-muted-foreground text-xs">
                          {asset.platform} · {asset.arch}
                          {asset.size ? ` · ${formatBytes(asset.size)}` : ""}
                        </p>
                      </div>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        disabled={!online || !asset.downloadUrl}
                      >
                        <a href={asset.downloadUrl ?? undefined}>
                          <Download className="h-4 w-4" />
                          Download
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {release.assets.length > 3 ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/platform/releases/${encodeURIComponent(release.version)}`}>
                    View all {release.assets.length} assets
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
