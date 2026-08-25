"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatNumber } from "@/lib/currency";
import { formatBytes } from "@/lib/bytes";
import { remainingDays, type PlanChangePreview } from "@/convex/shared/planChange";
import { RESOURCE_LABELS, type PlanUsageExcess } from "@/convex/shared/plans";

function formatDate(value: number | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatExcess(row: PlanUsageExcess): string {
  const label = RESOURCE_LABELS[row.resource];
  const used = row.resource === "backupBytes" ? formatBytes(row.used) : formatNumber(row.used);
  const limit = row.resource === "backupBytes" ? formatBytes(row.limit) : formatNumber(row.limit);
  return `${label}: ${used} / ${limit}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

type Props = {
  open: boolean;
  preview: PlanChangePreview | null;
  loading: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function PlanChangeDialog({
  open,
  preview,
  loading,
  pending,
  onOpenChange,
  onConfirm,
}: Props) {
  const intent = preview?.intent;
  const isDowngrade = intent === "downgrade";
  const isCancel = intent === "cancel_scheduled";
  const isPurchase = intent === "purchase";
  const title = !preview
    ? "Plan change"
    : isCancel
      ? `Keep ${preview.currentPlanName}`
      : isDowngrade
        ? `Downgrade to ${preview.targetPlanName}`
        : isPurchase
          ? `Subscribe to ${preview.targetPlanName}`
          : `Upgrade to ${preview.targetPlanName}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {loading || !preview ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Preparing billing preview…
          </div>
        ) : isCancel ? (
          <p className="text-sm leading-relaxed">
            Your scheduled downgrade will be cancelled. {preview.currentPlanName} stays active
            through {formatDate(preview.currentPeriodEnd)}. No payment is taken.
          </p>
        ) : isDowngrade ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed">
              Your current {preview.currentPlanName} plan remains active until{" "}
              {formatDate(preview.currentPeriodEnd)}. After that, your organization will move to{" "}
              {preview.targetPlanName}.
            </p>
            <div className="space-y-2">
              <Row
                label="Current"
                value={`${preview.currentPlanName} — ${formatCurrency(preview.currentPrice ?? 0)}/${preview.cycle === "yearly" ? "year" : "month"}`}
              />
              <Row
                label="Next"
                value={`${preview.targetPlanName} — ${formatCurrency(preview.targetPrice)}/${preview.cycle === "yearly" ? "year" : "month"}`}
              />
              <Row label="Charge today" value={formatCurrency(0)} />
              <Row
                label="Next renewal"
                value={`${formatCurrency(preview.nextBillingAmount ?? preview.targetPrice)} on ${formatDate(preview.nextBillingDate)}`}
              />
            </div>
            {preview.usageWarning.length > 0 ? (
              <div className="bg-muted/40 space-y-2 rounded-lg p-3">
                <p className="text-sm font-medium">
                  Your organization currently exceeds some {preview.targetPlanName} limits.
                </p>
                <p className="text-muted-foreground text-xs">
                  Existing products, users, devices, and history are kept. After the change you will
                  not be able to add more until usage is within the new limits.
                </p>
                <ul className="space-y-1 text-sm">
                  {preview.usageWarning.map((row) => (
                    <li key={row.resource}>{formatExcess(row)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Row
                label="Current"
                value={`${preview.currentPlanName}${preview.currentPrice !== null ? ` — ${formatCurrency(preview.currentPrice)}/${preview.cycle === "yearly" ? "year" : "month"}` : ""}`}
              />
              <Row
                label="New"
                value={`${preview.targetPlanName} — ${formatCurrency(preview.targetPrice)}${preview.cycle === "lifetime" ? " one-time" : preview.cycle === "yearly" ? "/year" : "/month"}`}
              />
              {preview.keepPeriod ? (
                <>
                  <Row
                    label="Current period"
                    value={`${formatDate(preview.currentPeriodStart)} – ${formatDate(preview.currentPeriodEnd)}`}
                  />
                  <Row
                    label="Remaining time"
                    value={`${remainingDays(preview.remainingMs)} days`}
                  />
                  <Row
                    label="Credit from current period"
                    value={formatCurrency(preview.currentCredit)}
                  />
                  <Row
                    label="Remaining new-plan value"
                    value={formatCurrency(preview.newPlanRemainingCost)}
                  />
                </>
              ) : null}
              <Row label="Amount due today" value={formatCurrency(preview.amountDueToday)} />
              <Row
                label="Next renewal"
                value={
                  preview.nextBillingAmount === null
                    ? "Never — lifetime licence"
                    : `${formatCurrency(preview.nextBillingAmount)} on ${formatDate(preview.nextBillingDate)}`
                }
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {isDowngrade ? `Keep ${preview?.currentPlanName ?? "plan"}` : "Cancel"}
          </Button>
          <Button type="button" disabled={loading || !preview || pending} onClick={onConfirm}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Working…
              </>
            ) : isDowngrade ? (
              "Schedule downgrade"
            ) : isCancel ? (
              `Keep ${preview?.currentPlanName}`
            ) : preview?.chargeToday ? (
              "Continue to payment"
            ) : (
              "Confirm"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
