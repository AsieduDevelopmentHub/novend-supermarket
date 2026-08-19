"use client";

import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { Download, ExternalLink, Package } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDateTime } from "@/lib/date";

type ReleasePayload = {
  ok: boolean;
  repo: string;
  message: string | null;
  releases: Array<{
    id: number;
    tag: string;
    title: string;
    prerelease: boolean;
    htmlUrl: string;
    publishedAt: string;
    notes: string | null;
    assets: Array<{
      name: string;
      size: number;
      contentType: string;
      url: string;
      downloadCount: number;
    }>;
  }>;
};

export function PlatformReleasesView() {
  const listDesktopReleases = useAction(api.platform.listDesktopReleases);
  const [payload, setPayload] = useState<ReleasePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listDesktopReleases({})
      .then((result) => {
        if (!cancelled) setPayload(result);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load releases");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [listDesktopReleases]);

  if (!payload && !error) {
    return <LoadingState label="Loading GitHub releases…" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Desktop releases"
        description="Installers published from git tags. Private repositories need GITHUB_TOKEN on the Convex deployment."
      />

      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : null}

      {payload && !payload.ok ? (
        <Card>
          <CardContent className="space-y-2 p-6 text-sm">
            <p className="font-medium">Could not read GitHub releases for {payload.repo}</p>
            <p className="text-muted-foreground">{payload.message}</p>
          </CardContent>
        </Card>
      ) : null}

      {payload?.ok && payload.releases.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No GitHub releases yet"
          description="Push a v* tag (matching package.json) to run Desktop Release and publish installers."
        />
      ) : null}

      {payload?.ok
        ? payload.releases.map((release) => (
            <Card key={release.id}>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                    {release.title}
                    <Badge variant="secondary">{release.tag}</Badge>
                    {release.prerelease ? <Badge variant="warning">Pre-release</Badge> : null}
                  </CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Published {formatDateTime(Date.parse(release.publishedAt))}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a href={release.htmlUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    GitHub
                  </a>
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {release.notes ? (
                  <pre className="bg-muted/40 text-muted-foreground max-h-48 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
                    {release.notes}
                  </pre>
                ) : null}
                {release.assets.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No installer assets on this release yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {release.assets.map((asset) => (
                      <li
                        key={asset.url}
                        className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{asset.name}</p>
                          <p className="text-muted-foreground text-xs">
                            {formatBytes(asset.size)} · {asset.downloadCount} downloads
                          </p>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <a href={asset.url}>
                            <Download className="h-4 w-4" />
                            Download
                          </a>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))
        : null}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
