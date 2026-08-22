"use client";

import { AlertTriangle, Boxes, Building2, HardDrive, Info, MonitorSmartphone, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/bytes";
import { formatNumber } from "@/lib/currency";
import type { UsageLevel, UsageMetric } from "@/convex/shared/licensing";
import { RESOURCE_LABELS, type LimitResource } from "@/convex/shared/plans";

const ICONS: Record<LimitResource, typeof Boxes> = {
  products: Boxes,
  users: Users,
  branches: Building2,
  devices: MonitorSmartphone,
  backupBytes: HardDrive,
};

const USAGE_CARD_LABELS: Record<LimitResource, string> = {
  products: "Products used",
  users: "Users used",
  branches: "Branches used",
  devices: "Devices activated",
  backupBytes: "Cloud backup used",
};

function formatValue(resource: LimitResource, value: number): string {
  return resource === "backupBytes" ? formatBytes(value) : formatNumber(value);
}

function levelCopy(metric: UsageMetric): string {
  const label = RESOURCE_LABELS[metric.resource].toLowerCase();
  if (metric.level === "full") {
    return `Limit reached — upgrade to add more ${label}.`;
  }
  if (metric.level === "warning") {
    return `${metric.percent}% used — you're almost at the limit.`;
  }
  if (metric.level === "info") {
    return `${metric.percent}% used — approaching your limit.`;
  }
  return `${formatValue(metric.resource, metric.remaining ?? 0)} remaining`;
}

/**
 * Usage meters for every metered resource on the plan.
 *
 * Primary at 80% is a heads-up; amber at 95% is a strong warning; amber at 100%
 * means new records of that one kind are blocked. Selling is never affected.
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
  const label = USAGE_CARD_LABELS[metric.resource];
  const used = formatValue(metric.resource, metric.used);
  const limit = metric.limit === null ? "Unlimited" : formatValue(metric.resource, metric.limit);

  return (
    <Card className={cn("min-w-0", cardTone(metric.level))}>
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
          <LevelIcon level={metric.level} />
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
                metric.level === "warning" && "[&>*]:bg-warning",
                metric.level === "info" && "[&>*]:bg-primary",
              )}
            />
            <p
              className={cn(
                "text-xs",
                metric.level === "full" || metric.level === "warning"
                  ? "text-warning"
                  : metric.level === "info"
                    ? "text-primary"
                    : "text-muted-foreground",
              )}
            >
              {levelCopy(metric)}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function cardTone(level: UsageLevel): string {
  if (level === "full") return "border-warning/60";
  if (level === "warning") return "border-warning/40";
  if (level === "info") return "border-primary/50";
  return "";
}

function LevelIcon({ level }: { level: UsageLevel }) {
  if (level === "ok") return null;
  if (level === "info") {
    return <Info className="text-primary h-4 w-4 shrink-0" aria-hidden />;
  }
  return <AlertTriangle className="text-warning h-4 w-4 shrink-0" aria-hidden />;
}
