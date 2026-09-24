"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { CircleAlert, Copy, ShieldCheck, WifiOff } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useBillingOverviewData } from "@/hooks/use-billing-offline";
import { formatCurrency } from "@/lib/currency";
import { showError } from "@/lib/errors";
import { toast } from "sonner";
import { PlanUsageGrid } from "./plan-usage-grid";
import { PlansGrid } from "./plans-grid";
import { BillingHistoryTable } from "./billing-history-table";
import type { AccessState, UsageMetric } from "@/convex/shared/licensing";
import { PLAN_CATALOG, type PlanKey } from "@/convex/shared/plans";
import type { ScheduledChangeSnapshot } from "@/convex/shared/planChange";
import { useLicense } from "@/hooks/use-license";

const ACCESS_BADGE: Record<
  AccessState,
  { label: string; variant: "success" | "secondary" | "warning" | "destructive" }
> = {
  active: { label: "Active", variant: "success" },
  trial: { label: "Trial", variant: "secondary" },
  grace: { label: "Payment overdue", variant: "warning" },
  suspended: { label: "Suspended", variant: "destructive" },
  expired: { label: "Expired", variant: "destructive" },
  disabled: { label: "Disabled", variant: "destructive" },
};

function formatDate(value: number | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isAccessState(value: string): value is AccessState {
  return value in ACCESS_BADGE;
}

type BillingSubscription = {
  status: string;
  isLifetime: boolean;
  expiresAt: number | null;
  nextBillingDate: number | null;
  cancelAtPeriodEnd: boolean;
} | null;

function periodDetail(
  subscription: BillingSubscription,
  accessState: AccessState,
  trialEndsAt?: number | null,
): { label: string; value: string } {
  if (subscription?.isLifetime) {
    return { label: "Licence", value: "Never expires" };
  }

  const endsAt = subscription?.expiresAt ?? trialEndsAt ?? null;

  if (accessState === "trial") {
    return { label: "Trial ends", value: formatDate(endsAt) };
  }

  const unsubscribed =
    Boolean(subscription?.cancelAtPeriodEnd) ||
    subscription?.status === "cancelled" ||
    subscription?.status === "expired" ||
    accessState === "expired";

  if (unsubscribed) {
    return { label: "Expires", value: formatDate(endsAt) };
  }

  return {
    label: "Renews",
    value: formatDate(subscription?.nextBillingDate ?? endsAt),
  };
}

/** Settings → Billing. Administrators only. Renders from cache while offline. */
export function BillingPanel() {
  const online = useConnectivity();
  const { data: overview, loading, source } = useBillingOverviewData();
  const { billingVisibility, commercial } = useLicense();
  const cancelSubscription = useAction(api.billing.cancelSubscription);
  const cancelScheduledChange = useAction(api.billing.cancelScheduledChange);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancellingSchedule, setCancellingSchedule] = useState(false);

  if (loading) {
    return <LoadingState label="Loading billing…" variant="form" />;
  }

  if (!overview) {
    return (
      <EmptyState
        title="No billing snapshot yet"
        description="Open Billing once while online to cache your plan, usage, and history for offline viewing."
      />
    );
  }

  const accessState = isAccessState(overview.access.state) ? overview.access.state : "active";
  const badge = ACCESS_BADGE[accessState];
  const subscription = overview.subscription;
  const scheduledChange = (subscription?.scheduledChange ?? null) as ScheduledChangeSnapshot | null;
  const canCancel = Boolean(
    online &&
    subscription &&
    !subscription.isLifetime &&
    !subscription.cancelAtPeriodEnd &&
    !scheduledChange,
  );
  const period = periodDetail(subscription, accessState, overview.trialEndsAt);

  async function onCancel() {
    if (!online) {
      toast.error("Connect to the internet to cancel a subscription.");
      return;
    }
    setCancelling(true);
    try {
      const result = await cancelSubscription({});
      toast.success(
        result.endsAt
          ? `Subscription ends on ${formatDate(result.endsAt)}`
          : "Subscription cancelled",
      );
    } catch (error) {
      showError(error, "Could not cancel the subscription");
    } finally {
      setCancelling(false);
      setConfirmCancel(false);
    }
  }

  async function onCancelSchedule() {
    if (!online) {
      toast.error("Connect to the internet to cancel a scheduled downgrade.");
      return;
    }
    setCancellingSchedule(true);
    try {
      const result = await cancelScheduledChange({});
      toast.success(
        result.currentPlanName
          ? `Your downgrade has been cancelled. Your ${result.currentPlanName} plan remains active.`
          : "Your scheduled downgrade has been cancelled.",
      );
    } catch (error) {
      showError(error, "Could not cancel the scheduled downgrade");
    } finally {
      setCancellingSchedule(false);
    }
  }

  return (
    <div className="space-y-6">
      {!online || source === "cache" ? (
        <Alert>
          <WifiOff className="h-4 w-4" aria-hidden />
          <AlertTitle>Using your last confirmed subscription</AlertTitle>
          <AlertDescription>
            Plan, limits, scheduled changes, and history stay available offline. Connect to pay,
            upgrade, or schedule a change.
          </AlertDescription>
        </Alert>
      ) : null}

      {overview.access.reason ? (
        <Alert variant={overview.access.canWrite ? "default" : "destructive"}>
          <CircleAlert className="h-4 w-4" aria-hidden />
          <AlertTitle>{overview.access.canWrite ? "Action needed" : "Read-only mode"}</AlertTitle>
          <AlertDescription>{overview.access.reason}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Current plan
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </CardTitle>
          <CardDescription>{overview.plan.tagline}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Plan" value={overview.plan.name} />
          <Detail label={period.label} value={period.value} />
          <Detail
            label="Billing"
            value={
              subscription
                ? subscription.isLifetime
                  ? `${formatCurrency(subscription.amount)} one-time`
                  : `${formatCurrency(subscription.amount)} / ${subscription.billingCycle === "yearly" ? "year" : "month"}`
                : "—"
            }
          />
          <OrganizationId id={overview.organizationId} />
        </CardContent>
      </Card>

      {scheduledChange ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Downgrade scheduled
              <Badge variant="warning">Upcoming</Badge>
            </CardTitle>
            <CardDescription>
              You stay on {overview.plan.name} until the current paid period ends. You are not on{" "}
              {PLAN_CATALOG[scheduledChange.targetPlanKey].name} yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Detail
              label="Current plan"
              value={`${overview.plan.name} · active until ${formatDate(subscription?.expiresAt ?? null)}`}
            />
            <Detail
              label="Upcoming plan"
              value={`${PLAN_CATALOG[scheduledChange.targetPlanKey].name} · starts ${formatDate(scheduledChange.effectiveAt)}`}
            />
            <Detail
              label="Next payment"
              value={formatCurrency(
                scheduledChange.targetCycle === "yearly"
                  ? (PLAN_CATALOG[scheduledChange.targetPlanKey].yearlyPrice ?? 0)
                  : (PLAN_CATALOG[scheduledChange.targetPlanKey].monthlyPrice ?? 0),
              )}
            />
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                disabled={!online || cancellingSchedule}
                onClick={() => void onCancelSchedule()}
              >
                {cancellingSchedule ? "Cancelling…" : "Cancel scheduled downgrade"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">Usage</h3>
          <p className="text-muted-foreground text-sm">
            Reaching a limit only blocks new records of that kind. Selling never stops. Cloud backup
            files are managed in Settings → Backups.
          </p>
        </div>
        <PlanUsageGrid usage={overview.usage as UsageMetric[]} />
      </section>

      <PlansGrid
        currentPlanKey={overview.planKey as PlanKey}
        currentCycle={(subscription?.billingCycle as "monthly" | "yearly" | "lifetime") ?? null}
        accessState={accessState}
        online={online}
        onlinePaymentsEnabled={overview.onlinePaymentsEnabled}
        scheduledChange={scheduledChange}
        billingVisibility={billingVisibility}
        commercialOffer={commercial.offer ?? null}
        canSelfServe={commercial.canSelfServe}
        organizationName={overview.organizationName}
      />

      <section className="space-y-3">
        <h3 className="text-base font-semibold">Payment history</h3>
        <BillingHistoryTable />
      </section>

      {canCancel ? (
        <Card>
          <CardHeader>
            <CardTitle>Cancel subscription</CardTitle>
            <CardDescription>
              Your plan keeps working until the end of the period you already paid for.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setConfirmCancel(true)}>
              Cancel subscription
            </Button>
          </CardContent>
        </Card>
      ) : subscription?.cancelAtPeriodEnd ? (
        <Alert>
          <ShieldCheck className="h-4 w-4" aria-hidden />
          <AlertTitle>Cancellation scheduled</AlertTitle>
          <AlertDescription>
            This plan ends on {formatDate(subscription.expiresAt)}. Choose a plan above to stay
            active.
          </AlertDescription>
        </Alert>
      ) : null}

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this subscription?"
        description="Novend will stop renewing this plan. You keep full access until the current period ends, then the business becomes read-only."
        confirmLabel={cancelling ? "Cancelling…" : "Cancel subscription"}
        cancelLabel="Keep plan"
        pending={cancelling}
        onConfirm={() => void onCancel()}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-xs tracking-wide uppercase">{label}</p>
      <p className="mt-1 font-medium break-words">{value}</p>
    </div>
  );
}

function OrganizationId({ id }: { id: string }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-xs tracking-wide uppercase">Organization ID</p>
      <div className="mt-1 flex items-center gap-1">
        <code className="bg-muted truncate rounded px-1.5 py-0.5 font-mono text-xs">{id}</code>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          aria-label="Copy organization ID"
          onClick={() => {
            void navigator.clipboard
              .writeText(id)
              .then(() => toast.success("Organization ID copied"))
              .catch(() => toast.error("Could not copy"));
          }}
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
