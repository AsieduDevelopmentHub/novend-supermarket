"use client";

import { AlertTriangle, Boxes, Building2, HardDrive, MonitorSmartphone, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/bytes";
import { formatNumber } from "@/lib/currency";
import type { UsageMetric } from "@/convex/shared/licensing";
import { RESOURCE_LABELS, type LimitResource } from "@/convex/shared/plans";

const ICONS: Record<LimitResource, typeof Boxes> = {
  products: Boxes,
  users: Users,
  branches: Building2,
  devices: MonitorSmartphone,
  backupBytes: HardDrive,
};

function formatValue(resource: LimitResource, value: number): string {
  return resource === "backupBytes" ? formatBytes(value) : formatNumber(value);
}

/**
 * Usage meters for every metered resource on the plan.
 *
 * Blue at 80% is a heads-up; amber at 100% means new records of that one kind
 * are blocked. Selling is never affected.
 */
export function PlanUsageGrid({ usage }: { usage: UsageMetric[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {usage.map((metric) => (
        <UsageCard key={metric.resource} metric={metric} />
      ))}
    </div>
  );
}

function UsageCard({ metric }: { metric: UsageMetric }) {
  const Icon = ICONS[metric.resource];
  const label = RESOURCE_LABELS[metric.resource];
  const used = formatValue(metric.resource, metric.used);
  const limit = metric.limit === null ? "Unlimited" : formatValue(metric.resource, metric.limit);

  return (
    <Card
      className={cn(
        "min-w-0",
        metric.level === "full" && "border-warning/60",
        metric.level === "warning" && "border-primary/50",
      )}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </p>
            <p className="mt-1.5 truncate text-xl font-semibold tracking-tight">
              {used}
              <span className="text-muted-foreground text-sm font-normal"> / {limit}</span>
            </p>
          </div>
          {metric.level !== "ok" ? (
            <AlertTriangle
              className={cn(
                "h-4 w-4 shrink-0",
                metric.level === "full" ? "text-warning" : "text-primary",
              )}
              aria-hidden
            />
          ) : null}
        </div>

        {metric.unlimited ? (
          <p className="text-muted-foreground text-xs">No limit on this plan.</p>
        ) : (
          <>
            <Progress
              value={metric.percent}
              aria-label={`${label} usage`}
              className={cn(
                metric.level === "full" && "[&>*]:bg-warning",
                metric.level === "warning" && "[&>*]:bg-primary",
              )}
            />
            <p
              className={cn(
                "text-xs",
                metric.level === "full"
                  ? "text-warning"
                  : metric.level === "warning"
                    ? "text-primary"
                    : "text-muted-foreground",
              )}
            >
              {metric.level === "full"
                ? `Limit reached — upgrade to add more ${label.toLowerCase()}.`
                : metric.level === "warning"
                  ? `${metric.percent}% used — approaching your limit.`
                  : `${formatValue(metric.resource, metric.remaining ?? 0)} remaining`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
