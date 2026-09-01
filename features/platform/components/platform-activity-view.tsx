"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, FileClock } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ListPagination } from "@/components/ui/list-pagination";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDateTime } from "@/lib/date";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useConvexPagedList } from "@/hooks/use-convex-paged-list";

type ActivitySource = "audit" | "telemetry";

export function PlatformActivityView() {
  const online = useConnectivity();
  const [source, setSource] = useState<ActivitySource>("audit");
  const activity = useConvexPagedList(
    api.platformMonitoring.activity,
    online ? { source } : "skip",
    { enabled: online, resetKey: source },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform activity"
        description="Security-sensitive admin actions and privacy-limited operational telemetry."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/platform">Back to monitoring</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Activity source">
        <Button
          type="button"
          size="sm"
          variant={source === "audit" ? "default" : "outline"}
          onClick={() => setSource("audit")}
        >
          Admin audit
        </Button>
        <Button
          type="button"
          size="sm"
          variant={source === "telemetry" ? "default" : "outline"}
          onClick={() => setSource("telemetry")}
        >
          Operational events
        </Button>
      </div>

      {!online ? (
        <Card>
          <CardContent className="text-muted-foreground p-6 text-sm">
            Activity details require a connection. The executive dashboard remains available from
            its cached snapshot.
          </CardContent>
        </Card>
      ) : activity.isLoading ? (
        <LoadingState label="Loading platform activity…" />
      ) : activity.items.length === 0 ? (
        <EmptyState
          icon={source === "audit" ? FileClock : Activity}
          title={source === "audit" ? "No admin actions yet" : "No telemetry events yet"}
        />
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Area</th>
                  <th className="px-5 py-3 font-medium">Organization</th>
                  <th className="px-5 py-3 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {activity.items.map((row) => (
                  <tr key={String(row.id)} className="border-border border-t">
                    <td className="px-5 py-3 whitespace-nowrap">
                      {formatDateTime(row.occurredAt)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={row.source === "audit" ? "outline" : "secondary"}>
                        {row.actionLabel ?? humanize(row.action)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">{row.areaLabel ?? humanize(row.entityType)}</td>
                    <td className="px-5 py-3">
                      {row.organizationId ? (
                        <Link
                          href={`/platform/${row.organizationId}`}
                          className="text-primary font-medium hover:underline"
                        >
                          {row.organizationName ?? "Organization"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Platform</span>
                      )}
                    </td>
                    <td className="text-muted-foreground max-w-[320px] truncate px-5 py-3">
                      {row.detail ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
          <ListPagination
            page={activity.page}
            pageSize={activity.pageSize}
            total={activity.total}
            hasNextPage={activity.hasNextPage}
            onPageChange={activity.setPage}
            onPageSizeChange={activity.setPageSize}
          />
        </Card>
      )}
      {activity.isLoadingPage ? <LoadingState label="Loading page…" /> : null}
    </div>
  );
}

function humanize(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
