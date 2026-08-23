"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { Check, Loader2, Sparkles, WifiOff } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/currency";
import { formatBytes } from "@/lib/bytes";
import { showError } from "@/lib/errors";
import { toast } from "sonner";
import {
  PLAN_CATALOG,
  PLAN_LIST,
  RESOURCE_LABELS,
  planChangeKind,
  planLimitLines,
  usageExceedsLimits,
  type BillingCycle,
  type LimitResource,
  type PlanDefinition,
  type PlanKey,
  type PlanUsageExcess,
} from "@/convex/shared/plans";
import type { AccessState, UsageMetric } from "@/convex/shared/licensing";

type Props = {
  currentPlanKey: PlanKey;
  currentCycle: BillingCycle | null;
  accessState: AccessState;
  usage: UsageMetric[];
  online: boolean;
  onlinePaymentsEnabled: boolean;
  disabled?: boolean;
};

function usedByResource(usage: UsageMetric[]): Partial<Record<LimitResource, number>> {
  const used: Partial<Record<LimitResource, number>> = {};
  for (const metric of usage) {
    used[metric.resource] = metric.used;
  }
  return used;
}

function actionLabel(
  plan: PlanDefinition,
  currentPlanKey: PlanKey,
  accessState: AccessState,
): string {
  const kind = planChangeKind(currentPlanKey, plan.key);
  if (plan.isLifetime) return "Buy lifetime licence";
  if (kind === "same") {
    if (accessState === "trial") return "Pay now";
    if (accessState === "grace" || accessState === "expired") return "Renew now";
    return "Current plan";
  }
  if (kind === "upgrade") return `Upgrade to ${plan.name}`;
  return `Downgrade to ${plan.name}`;
}

function formatExcess(row: PlanUsageExcess): string {
  const label = RESOURCE_LABELS[row.resource];
  const used =
    row.resource === "backupBytes" ? formatBytes(row.used) : formatNumber(row.used);
  const limit =
    row.resource === "backupBytes" ? formatBytes(row.limit) : formatNumber(row.limit);
  const reduce =
    row.resource === "backupBytes" ? formatBytes(row.reduceBy) : formatNumber(row.reduceBy);
  return `${label}: ${used} / ${limit} — reduce by ${reduce}`;
}

/**
 * Plan comparison and self-service checkout.
 *
 * Pay Now stays available during trial. Downgrades that exceed the target
 * limits are blocked in the UI (no data is deleted). Payment itself needs
 * a connection; the rest of Billing stays usable offline.
 */
export function PlansGrid({
  currentPlanKey,
  currentCycle,
  accessState,
  usage,
  online,
  onlinePaymentsEnabled,
  disabled = false,
}: Props) {
  const [cycle, setCycle] = useState<Exclude<BillingCycle, "lifetime">>(
    currentCycle === "yearly" ? "yearly" : "monthly",
  );
  const [pendingPlan, setPendingPlan] = useState<PlanKey | null>(null);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [excess, setExcess] = useState<PlanUsageExcess[] | null>(null);
  const startCheckout = useAction(api.billing.startCheckout);

  async function startPayment(plan: PlanDefinition) {
    const chosenCycle: BillingCycle = plan.isLifetime ? "lifetime" : cycle;
    setPendingPlan(plan.key);
    try {
      const result = await startCheckout({ planKey: plan.key, cycle: chosenCycle });
      if (result.kind === "redirect") {
        window.location.assign(result.url);
        return;
      }
      toast.success(`${plan.name} activated`);
    } catch (error) {
      showError(error, "Could not start checkout");
    } finally {
      setPendingPlan(null);
    }
  }

  function onChoose(plan: PlanDefinition) {
    if (!online) {
      setOfflineOpen(true);
      return;
    }
    const kind = planChangeKind(currentPlanKey, plan.key);
    if (kind === "same" && accessState === "active" && !plan.isLifetime) {
      return;
    }
    if (kind === "downgrade") {
      const over = usageExceedsLimits(usedByResource(usage), PLAN_CATALOG[plan.key].limits);
      if (over.length > 0) {
        setExcess(over);
        return;
      }
    }
    void startPayment(plan);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Available plans</h3>
          <p className="text-muted-foreground text-sm">
            Prices are in Ghana cedis. Subscribe or change plan at any time — including during trial.
          </p>
        </div>
        <div
          className="border-border bg-muted/40 inline-flex rounded-lg border p-1"
          role="group"
          aria-label="Billing cycle"
        >
          {(["monthly", "yearly"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={cycle === option}
              onClick={() => setCycle(option)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                cycle === option
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option}
              {option === "yearly" ? (
                <span className="text-primary ml-1.5 text-xs font-semibold">−2 months</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_LIST.map((plan) => {
          const kind = planChangeKind(currentPlanKey, plan.key);
          const isCurrentPaid =
            kind === "same" && accessState === "active" && !plan.isLifetime;
          return (
            <PlanCard
              key={plan.key}
              plan={plan}
              cycle={cycle}
              isCurrent={kind === "same"}
              label={actionLabel(plan, currentPlanKey, accessState)}
              pending={pendingPlan === plan.key}
              disabled={disabled || pendingPlan !== null || isCurrentPaid}
              onlinePaymentsEnabled={onlinePaymentsEnabled}
              onChoose={() => onChoose(plan)}
            />
          );
        })}
      </div>

      <Dialog open={offlineOpen} onOpenChange={setOfflineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WifiOff className="h-4 w-4" aria-hidden />
              You&apos;re currently offline
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Connect to the internet to continue with payment. Your current plan and limits stay
            available in the meantime.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOfflineOpen(false)}>
              Stay on billing
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (navigator.onLine) {
                  setOfflineOpen(false);
                  return;
                }
                toast.error("Still offline — try again when you have a connection.");
              }}
            >
              Try again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(excess)} onOpenChange={(open) => !open && setExcess(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usage exceeds the lower plan</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Novend will not delete products, users, devices, or backups. Reduce usage first, or keep
            your current plan.
          </p>
          {excess ? (
            <ul className="space-y-2 text-sm">
              {excess.map((row) => (
                <li key={row.resource} className="bg-muted/40 rounded-lg px-3 py-2">
                  {formatExcess(row)}
                </li>
              ))}
            </ul>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExcess(null)}>
              Keep current plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function planPrice(plan: PlanDefinition, cycle: Exclude<BillingCycle, "lifetime">) {
  if (plan.isLifetime) {
    return { amount: plan.oneTimePrice, suffix: "one-time" };
  }
  return {
    amount: cycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice,
    suffix: cycle === "yearly" ? "per year" : "per month",
  };
}

function PlanCard({
  plan,
  cycle,
  isCurrent,
  label,
  pending,
  disabled,
  onlinePaymentsEnabled,
  onChoose,
}: {
  plan: PlanDefinition;
  cycle: Exclude<BillingCycle, "lifetime">;
  isCurrent: boolean;
  label: string;
  pending: boolean;
  disabled: boolean;
  onlinePaymentsEnabled: boolean;
  onChoose: () => void;
}) {
  const { amount, suffix } = planPrice(plan, cycle);

  return (
    <Card
      className={cn(
        "flex min-w-0 flex-col",
        plan.featured && "border-primary ring-primary/15 ring-2",
        isCurrent && "border-success/60",
      )}
    >
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <div className="space-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <h4 className="text-base font-semibold">{plan.name}</h4>
            {isCurrent ? <Badge variant="success">Current</Badge> : null}
            {!isCurrent && plan.featured ? (
              <Badge className="gap-1">
                <Sparkles className="h-3 w-3" aria-hidden />
                Most Popular
              </Badge>
            ) : null}
            {plan.isLifetime ? <Badge variant="outline">Lifetime</Badge> : null}
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">{plan.tagline}</p>
        </div>

        <div>
          <p className="text-2xl font-semibold tracking-tight">
            {plan.priceFrom ? <span className="text-muted-foreground text-sm">From </span> : null}
            {amount === null ? "Custom" : formatCurrency(amount)}
          </p>
          <p className="text-muted-foreground text-xs">{amount === null ? "Talk to us" : suffix}</p>
        </div>

        <ul className="text-muted-foreground border-border space-y-1 border-t pt-3 text-xs leading-relaxed">
          {planLimitLines(plan).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <ul className="flex-1 space-y-1.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <Check className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <Button
          className="h-auto min-h-11 w-full px-3 whitespace-normal"
          variant={isCurrent || !plan.featured ? "outline" : "default"}
          disabled={disabled || !onlinePaymentsEnabled}
          onClick={onChoose}
        >
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
              Opening checkout…
            </>
          ) : (
            label
          )}
        </Button>

        {!onlinePaymentsEnabled && plan.selfServe && !disabled ? (
          <p className="text-muted-foreground text-xs">
            Online payments are not configured yet — contact Novend to activate this plan.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
