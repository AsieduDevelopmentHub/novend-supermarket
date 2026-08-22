"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { CircleAlert, Info, TrendingUp } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePermissions } from "@/hooks/use-permissions";
import { RESOURCE_LABELS, type LimitResource } from "@/convex/shared/plans";
import { formatBytes } from "@/lib/bytes";
import { cn } from "@/lib/utils";

function formatQuantity(resource: LimitResource, value: number): string {
  return resource === "backupBytes" ? formatBytes(value) : value.toLocaleString();
}

/**
 * Warns before a plan limit is reached instead of failing at save time.
 *
 * Renders nothing until usage crosses 80%, so healthy businesses never see
 * billing noise on their working screens.
 */
export function PlanLimitNotice({ resource }: { resource: LimitResource }) {
  const online = useConnectivity();
  const { isCashier, isAdmin, isLoading } = usePermissions();
  const data = useQuery(api.billing.usageSnapshot, online && !isCashier && !isLoading ? {} : "skip");

  const metric = data?.usage.find((item) => item.resource === resource);
  if (!data || !metric || metric.level === "ok" || metric.limit === null) return null;

  const full = metric.level === "full";
  const strong = metric.level === "warning";
  const label = RESOURCE_LABELS[resource].toLowerCase();
  const used = formatQuantity(resource, metric.used);
  const limit = formatQuantity(resource, metric.limit);

  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-3 text-sm",
        full || strong
          ? "border-warning/30 bg-warning/10 text-warning"
          : "border-primary/30 bg-primary/10 text-primary",
      )}
    >
      {full ? (
        <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
      ) : strong ? (
        <TrendingUp className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <Info className="h-4 w-4 shrink-0" aria-hidden />
      )}
      <p className="min-w-0 flex-1">
        {full
          ? `You've used all ${limit} ${label} on the ${data.planName} plan.`
          : strong
            ? `${used} of ${limit} ${label} used on the ${data.planName} plan — you're almost at the limit.`
            : `${used} of ${limit} ${label} used on the ${data.planName} plan.`}
      </p>
      {isAdmin ? (
        <Button asChild size="sm" variant={full || strong ? "default" : "outline"}>
          <Link href="/settings?section=billing">Upgrade plan</Link>
        </Button>
      ) : null}
    </div>
  );
}
