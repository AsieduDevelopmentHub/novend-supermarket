"use client";

import Link from "next/link";
import { CircleAlert, Clock, WifiOff } from "lucide-react";
import { useLicense } from "@/hooks/use-license";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import type { AccessState } from "@/convex/shared/licensing";

function daysUntil(timestamp: number | null): number | null {
  if (!timestamp) return null;
  return Math.max(0, Math.ceil((timestamp - Date.now()) / (24 * 60 * 60 * 1000)));
}

function mobileSummary(
  state: AccessState,
  reason: string,
  trialDays: number | null,
  fromCache: boolean,
): string {
  if (fromCache) return "Offline — using your last confirmed plan.";
  if (state === "trial") {
    if (trialDays === null) return "Free trial — choose a plan soon.";
    return `Free trial · ${trialDays} ${trialDays === 1 ? "day" : "days"} left`;
  }
  if (state === "grace") return "Payment overdue — renew to stay active.";
  if (state === "expired") return "Subscription expired — renew to sell again.";
  if (state === "suspended") return "Business suspended — new activity paused.";
  if (state === "disabled") return "Business disabled — contact support.";
  return reason;
}

/**
 * Business-wide licence notice shown above the workspace.
 *
 * Read-only states are the loudest because they change what the team can do at
 * the counter; trial and grace states are informative, not alarming.
 */
export function LicenseBanner() {
  const { access, isLoading, fromCache, subscription } = useLicense();
  const { isAdmin } = usePermissions();

  if (isLoading || !access.reason) return null;

  const blocking = !access.canWrite;
  const trialDays = access.state === "trial" ? daysUntil(subscription?.expiresAt ?? null) : null;
  const Icon = fromCache ? WifiOff : blocking ? CircleAlert : Clock;
  const desktopText = `${access.reason}${
    trialDays !== null ? ` ${trialDays} ${trialDays === 1 ? "day" : "days"} left.` : ""
  }`;
  const mobileText = mobileSummary(access.state, access.reason, trialDays, fromCache);

  return (
    <div
      role="status"
      className={cn(
        "flex shrink-0 items-center gap-2 border-b px-3 py-1.5 text-xs sm:gap-3 sm:px-4 sm:py-2 sm:text-sm lg:px-8",
        blocking
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-warning/30 bg-warning/10 text-warning",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
      <span className="min-w-0 flex-1 truncate sm:hidden" title={desktopText}>
        {mobileText}
      </span>
      <span className="hidden min-w-0 flex-1 sm:inline">{desktopText}</span>
      {isAdmin ? (
        <Link
          href="/settings?section=billing"
          className="shrink-0 text-xs font-medium underline sm:text-sm"
        >
          <span className="sm:hidden">Billing</span>
          <span className="hidden sm:inline">Open billing</span>
        </Link>
      ) : null}
    </div>
  );
}
