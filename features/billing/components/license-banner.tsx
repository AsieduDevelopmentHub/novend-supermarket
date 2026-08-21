"use client";

import Link from "next/link";
import { CircleAlert, Clock, WifiOff } from "lucide-react";
import { useLicense } from "@/hooks/use-license";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";

function daysUntil(timestamp: number | null): number | null {
  if (!timestamp) return null;
  return Math.max(0, Math.ceil((timestamp - Date.now()) / (24 * 60 * 60 * 1000)));
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

  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm lg:px-8",
        blocking
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-warning/30 bg-warning/10 text-warning",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        {access.reason}
        {trialDays !== null ? ` ${trialDays} ${trialDays === 1 ? "day" : "days"} left.` : ""}
      </span>
      {isAdmin ? (
        <Link href="/settings?section=billing" className="shrink-0 font-medium underline">
          Open billing
        </Link>
      ) : null}
    </div>
  );
}
