"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/currency";
import { formatBytes } from "@/lib/bytes";
import { showError } from "@/lib/errors";
import { toast } from "sonner";
import { LANDING_CONTACT_EMAIL } from "@/features/marketing/content";
import {
  PLAN_LIST,
  type BillingCycle,
  type PlanDefinition,
  type PlanKey,
} from "@/convex/shared/plans";

type Props = {
  currentPlanKey: PlanKey;
  currentCycle: BillingCycle | null;
  onlinePaymentsEnabled: boolean;
  disabled?: boolean;
};

/**
 * Plan comparison and self-service checkout.
 *
 * Checkout stays available while a business is suspended or expired — renewing
 * is exactly what a locked-out administrator needs to do.
 */
export function PlansGrid({
  currentPlanKey,
  currentCycle,
  onlinePaymentsEnabled,
  disabled = false,
}: Props) {
  const [cycle, setCycle] = useState<Exclude<BillingCycle, "lifetime">>(
    currentCycle === "yearly" ? "yearly" : "monthly",
  );
  const [pendingPlan, setPendingPlan] = useState<PlanKey | null>(null);
  const startCheckout = useAction(api.billing.startCheckout);

  async function onChoose(plan: PlanDefinition) {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Available plans</h3>
          <p className="text-muted-foreground text-sm">
            Prices are in Ghana cedis. Change or cancel at any time.
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
        {PLAN_LIST.map((plan) => (
          <PlanCard
            key={plan.key}
            plan={plan}
            cycle={cycle}
            isCurrent={plan.key === currentPlanKey}
            pending={pendingPlan === plan.key}
            disabled={disabled || pendingPlan !== null}
            onlinePaymentsEnabled={onlinePaymentsEnabled}
            onChoose={() => void onChoose(plan)}
          />
        ))}
      </div>
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

function limitLine(plan: PlanDefinition): string {
  const parts = [
    plan.limits.products === null
      ? "Unlimited products"
      : `${formatNumber(plan.limits.products)} products`,
    plan.limits.users === null ? "unlimited users" : `${plan.limits.users} users`,
    plan.limits.branches === null ? "unlimited branches" : `${plan.limits.branches} branches`,
    plan.limits.devices === null ? "unlimited devices" : `${plan.limits.devices} devices`,
    plan.limits.backupBytes === null
      ? "unlimited backup"
      : `${formatBytes(plan.limits.backupBytes)} cloud backup`,
  ];
  return parts.join(" · ");
}

function PlanCard({
  plan,
  cycle,
  isCurrent,
  pending,
  disabled,
  onlinePaymentsEnabled,
  onChoose,
}: {
  plan: PlanDefinition;
  cycle: Exclude<BillingCycle, "lifetime">;
  isCurrent: boolean;
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
          <div className="flex items-center gap-2">
            <h4 className="text-base font-semibold">{plan.name}</h4>
            {plan.featured ? (
              <Badge className="gap-1">
                <Sparkles className="h-3 w-3" aria-hidden />
                Recommended
              </Badge>
            ) : null}
            {isCurrent ? <Badge variant="success">Current</Badge> : null}
          </div>
          <p className="text-muted-foreground text-sm">{plan.tagline}</p>
        </div>

        <div>
          <p className="text-2xl font-semibold tracking-tight">
            {plan.priceFrom ? <span className="text-muted-foreground text-sm">From </span> : null}
            {amount === null ? "Custom" : formatCurrency(amount)}
          </p>
          <p className="text-muted-foreground text-xs">{amount === null ? "Talk to us" : suffix}</p>
        </div>

        <p className="text-muted-foreground border-border border-t pt-3 text-xs leading-relaxed">
          {limitLine(plan)}
        </p>

        <ul className="flex-1 space-y-1.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <Check className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {isCurrent ? (
          <Button variant="outline" disabled className="w-full">
            {plan.isLifetime ? "One-time licence activated" : "Current plan"}
          </Button>
        ) : !plan.selfServe ? (
          <Button variant="outline" asChild className="w-full">
            <a href={`mailto:${LANDING_CONTACT_EMAIL}?subject=Novend%20${plan.name}%20plan`}>
              Contact sales
            </a>
          </Button>
        ) : (
          <Button
            className="w-full"
            variant={plan.featured ? "default" : "outline"}
            disabled={disabled || !onlinePaymentsEnabled}
            onClick={onChoose}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Opening checkout…
              </>
            ) : plan.isLifetime ? (
              "Buy lifetime licence"
            ) : (
              `Switch to ${plan.name}`
            )}
          </Button>
        )}

        {!onlinePaymentsEnabled && plan.selfServe && !isCurrent ? (
          <p className="text-muted-foreground text-xs">
            Online payments are not configured yet — contact Novend to activate this plan.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
