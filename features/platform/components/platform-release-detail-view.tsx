"use client";

import Link from "next/link";
import { ArrowLeft, Download, Package } from "lucide-react";
import { PageHeader } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { formatDateTime } from "@/lib/date";
import { groupReleaseAssets, RELEASE_GROUP_LABELS } from "@/lib/platform/release-assets";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePlatformReleaseBundleData } from "@/hooks/use-platform-offline-data";

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PlatformReleaseDetailView({ version }: { version: string }) {
  const online = useConnectivity();
  const { data: release, loading } = usePlatformReleaseBundleData(version);

  if (loading || release === undefined) {
    return <LoadingState label="Loading release…" />;
  }
  if (!release) {
    return (
      <ErrorState
        title="Release not found"
        message="No desktop or mobile release matches this version on the server or local cache."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={release.tag}
        description={`Version ${release.version} · ${release.channel}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/platform/releases">
              <ArrowLeft className="h-4 w-4" />
              Downloads
            </Link>
          </Button>
        }
      />

      {!online ? (
        <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-sm">
          Showing cached release metadata. Fresh downloads need a connection.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{release.version}</Badge>
        <Badge variant="outline">{release.channel}</Badge>
        {release.mandatory ? <Badge variant="warning">Mandatory</Badge> : null}
        {release.desktop ? <Badge variant="outline">Desktop</Badge> : null}
        {release.mobile ? <Badge variant="outline">Mobile</Badge> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Release notes</CardTitle>
        </CardHeader>
        <CardContent>
          {release.notes ? (
            <pre className="bg-muted/40 max-h-64 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
              {release.notes}
            </pre>
          ) : (
            <p className="text-muted-foreground text-sm">No notes published for this version.</p>
          )}
          <p className="text-muted-foreground mt-3 text-xs">
            Published {formatDateTime(release.releasedAt)}
          </p>
          {release.githubReleaseUrl ? (
            <Button asChild size="sm" variant="outline" className="mt-3">
              <a href={release.githubReleaseUrl} target="_blank" rel="noreferrer">
                GitHub release
              </a>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Assets
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {release.assets.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Package} title="No assets on this release" />
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Platform</th>
                  <th className="px-4 py-3 font-medium">File</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Size</th>
                  <th className="px-4 py-3 font-medium">Download</th>
                </tr>
              </thead>
              <tbody>
                {groupReleaseAssets(release.assets).map(({ label, asset }) => (
                  <tr
                    key={`${asset.source}-${asset.githubAssetId}`}
                    className="border-border border-t"
                  >
                    <td className="px-4 py-3 font-medium">{label}</td>
                    <td className="px-4 py-3 text-xs">{asset.fileName}</td>
                    <td className="px-4 py-3 capitalize">
                      {asset.source}
                      {asset.arch ? ` · ${asset.arch}` : ""}
                    </td>
                    <td className="px-4 py-3">{formatBytes(asset.size) || "—"}</td>
                    <td className="px-4 py-3">
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
                    </td>
                  </tr>
                ))}
                {!release.assets.some((asset) => asset.kind === "ipa") ? (
                  <tr className="border-border bg-muted/20 border-t">
                    <td className="px-4 py-3 font-medium">{RELEASE_GROUP_LABELS.ios}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs" colSpan={3}>
                      Not published yet
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">Coming soon</Badge>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
