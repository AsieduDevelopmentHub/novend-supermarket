"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
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
import { formatCurrency } from "@/lib/currency";
import { showError } from "@/lib/errors";
import { toast } from "sonner";
import {
  PLAN_LIST,
  planChangeKind,
  planLimitLines,
  type BillingCycle,
  type PlanDefinition,
  type PlanKey,
} from "@/convex/shared/plans";
import type { AccessState } from "@/convex/shared/licensing";
import type { ScheduledChangeSnapshot } from "@/convex/shared/planChange";
import { PlanChangeDialog } from "./plan-change-dialog";

type Props = {
  currentPlanKey: PlanKey;
  currentCycle: BillingCycle | null;
  accessState: AccessState;
  online: boolean;
  onlinePaymentsEnabled: boolean;
  scheduledChange?: ScheduledChangeSnapshot | null;
  disabled?: boolean;
};

function formatDate(value: number | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function actionLabel(
  plan: PlanDefinition,
  currentPlanKey: PlanKey,
  accessState: AccessState,
  scheduledChange?: ScheduledChangeSnapshot | null,
): string {
  const kind = planChangeKind(currentPlanKey, plan.key);
  if (plan.isLifetime) return "Buy lifetime licence";
  if (kind === "same") {
    if (scheduledChange) return `Keep ${plan.name}`;
    if (accessState === "trial") return "Pay now";
    if (accessState === "grace" || accessState === "expired") return "Renew now";
    return "Current plan";
  }
  if (kind === "upgrade") return `Upgrade to ${plan.name}`;
  if (scheduledChange?.targetPlanKey === plan.key) return "Downgrade scheduled";
  return `Downgrade to ${plan.name}`;
}

/**
 * Plan comparison and self-service checkout.
 *
 * Upgrades open a backend-authored proration preview, then Paystack.
 * Downgrades are scheduled for period end with no charge today.
 */
export function PlansGrid({
  currentPlanKey,
  currentCycle,
  accessState,
  online,
  onlinePaymentsEnabled,
  scheduledChange = null,
  disabled = false,
}: Props) {
  const [cycle, setCycle] = useState<Exclude<BillingCycle, "lifetime">>(
    currentCycle === "yearly" ? "yearly" : "monthly",
  );
  const [pendingPlan, setPendingPlan] = useState<PlanKey | null>(null);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [dialogPlan, setDialogPlan] = useState<PlanDefinition | null>(null);
  const startCheckout = useAction(api.billing.startCheckout);
  const scheduleDowngrade = useAction(api.billing.scheduleDowngrade);

  const dialogCycle: BillingCycle = dialogPlan?.isLifetime ? "lifetime" : cycle;
  const preview = useQuery(
    api.billing.previewPlanChange,
    dialogPlan && online ? { planKey: dialogPlan.key, cycle: dialogCycle } : "skip",
  );

  async function confirmChange() {
    if (!dialogPlan || !preview) return;
    const chosenCycle: BillingCycle = dialogPlan.isLifetime ? "lifetime" : cycle;
    setPendingPlan(dialogPlan.key);
    try {
      if (preview.intent === "downgrade") {
        const result = await scheduleDowngrade({
          planKey: dialogPlan.key,
          cycle: chosenCycle,
        });
        toast.success(`Your downgrade is scheduled for ${formatDate(result.effectiveAt)}.`);
        setDialogPlan(null);
        return;
      }
      const result = await startCheckout({ planKey: dialogPlan.key, cycle: chosenCycle });
      if (result.kind === "cancelled_schedule") {
        toast.success(
          `Your scheduled downgrade has been cancelled. Your ${preview.currentPlanName} plan remains active.`,
        );
        setDialogPlan(null);
        return;
      }
      if (result.kind === "redirect") {
        window.location.assign(result.url);
        return;
      }
      toast.success("Your subscription has been updated.");
      setDialogPlan(null);
    } catch (error) {
      showError(error, "Could not update the subscription");
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
    if (kind === "same" && accessState === "active" && !plan.isLifetime && !scheduledChange) {
      return;
    }
    setDialogPlan(plan);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Available plans</h3>
          <p className="text-muted-foreground text-sm">
            Upgrades take effect after payment. Downgrades wait until the period you already paid
            for ends.
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
            kind === "same" && accessState === "active" && !plan.isLifetime && !scheduledChange;
          return (
            <PlanCard
              key={plan.key}
              plan={plan}
              cycle={cycle}
              isCurrent={kind === "same"}
              scheduled={scheduledChange?.targetPlanKey === plan.key}
              scheduledDate={
                scheduledChange?.targetPlanKey === plan.key ? scheduledChange.effectiveAt : null
              }
              label={actionLabel(plan, currentPlanKey, accessState, scheduledChange)}
              pending={pendingPlan === plan.key}
              disabled={disabled || pendingPlan !== null || isCurrentPaid}
              onlinePaymentsEnabled={onlinePaymentsEnabled}
              onChoose={() => onChoose(plan)}
            />
          );
        })}
      </div>

      <PlanChangeDialog
        open={Boolean(dialogPlan)}
        preview={preview ?? null}
        loading={Boolean(dialogPlan && preview === undefined)}
        pending={pendingPlan !== null}
        onOpenChange={(open) => {
          if (!open) setDialogPlan(null);
        }}
        onConfirm={() => void confirmChange()}
      />

      <Dialog open={offlineOpen} onOpenChange={setOfflineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WifiOff className="h-4 w-4" aria-hidden />
              You&apos;re currently offline
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            You&apos;re offline. Connect to the internet to continue with payment. Your current
            plan, limits, and any scheduled change stay available.
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
  scheduled,
  scheduledDate,
  label,
  pending,
  disabled,
  onlinePaymentsEnabled,
  onChoose,
}: {
  plan: PlanDefinition;
  cycle: Exclude<BillingCycle, "lifetime">;
  isCurrent: boolean;
  scheduled: boolean;
  scheduledDate: number | null;
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
            {scheduled ? <Badge variant="warning">Starts {formatDate(scheduledDate)}</Badge> : null}
            {!isCurrent && !scheduled && plan.featured ? (
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
            {amount === null ? "Custom" : formatCurrency(amount)}
            {amount !== null && plan.priceFrom ? (
              <span className="text-muted-foreground text-lg font-semibold">+</span>
            ) : null}
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
              Working…
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
