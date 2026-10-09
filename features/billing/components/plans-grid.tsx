"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Loader2, Mail, Sparkles, WifiOff } from "lucide-react";
import { Hardware } from "@novend/hardware";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
import { VerifyEmailDialog } from "@/features/auth/components/verify-email-dialog";
import { buildSalesMailto } from "@/features/marketing/content";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { showError } from "@/lib/errors";
import { toast } from "sonner";
import {
  SELLABLE_PLAN_LIST,
  planChangeKind,
  planLimitLines,
  resolvePlan,
  type BillingCycle,
  type PlanDefinition,
  type PlanKey,
} from "@/convex/shared/plans";
import type { AccessState, CommercialOfferSnapshot } from "@/convex/shared/licensing";
import type { BillingVisibility } from "@/convex/shared/organizationConfig";
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
  billingVisibility?: BillingVisibility;
  commercialOffer?: CommercialOfferSnapshot | null;
  canSelfServe?: boolean;
  organizationName?: string | null;
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

function offerPriceForCycle(
  offer: CommercialOfferSnapshot,
  cycle: Exclude<BillingCycle, "lifetime">,
): number | null {
  if (!offer.allowedCycles.includes(cycle)) return null;
  const amount = cycle === "yearly" ? offer.yearlyPrice : offer.monthlyPrice;
  return typeof amount === "number" ? amount : null;
}

function offerAsPlanDefinition(offer: CommercialOfferSnapshot): PlanDefinition {
  const base = resolvePlan(offer.basePlanKey);
  const lifetimeOnly =
    offer.allowedCycles.includes("lifetime") &&
    !offer.allowedCycles.includes("monthly") &&
    !offer.allowedCycles.includes("yearly");
  return {
    ...base,
    key: offer.basePlanKey,
    name: offer.name,
    tagline: offer.customerMessage?.trim() || "Configured for your business",
    monthlyPrice: offer.monthlyPrice ?? null,
    yearlyPrice: offer.yearlyPrice ?? null,
    oneTimePrice: offer.lifetimePrice ?? null,
    isLifetime: lifetimeOnly,
    selfServe: !lifetimeOnly,
    featured: true,
    marketingVisible: false,
    homepageHighlight: false,
    features: [
      ...(offer.customerMessage ? [offer.customerMessage] : []),
      ...base.features.slice(0, 4),
    ],
  };
}

function offerContactMailto(
  offer: CommercialOfferSnapshot,
  organizationName?: string | null,
): string {
  return buildSalesMailto({
    subject: `Commercial offer: ${offer.name}`,
    body: [
      "Hello Novend,",
      "",
      `I am writing about our commercial offer "${offer.name}".`,
      organizationName ? `Organization: ${organizationName}` : null,
      `Base plan: ${offer.basePlanKey}`,
      "",
      "Please contact me to proceed with payment or activation.",
      "",
      "Thank you,",
      "Full name:",
      "Phone / WhatsApp:",
      "Email:",
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
  });
}

async function openMailto(href: string) {
  try {
    await Hardware.app.openExternalUrl(href);
  } catch {
    window.location.assign(href);
  }
}

/**
 * Plan comparison and self-service checkout.
 *
 * Upgrades open a backend-authored proration preview, then Paystack.
 * Downgrades are scheduled for period end with no charge today.
 * When billingVisibility is custom_offer_only, only the assigned offer is shown.
 * Pay starts Paystack checkout at the offer price; Contact opens a sales mailto.
 */
export function PlansGrid({
  currentPlanKey,
  currentCycle,
  accessState,
  online,
  onlinePaymentsEnabled,
  scheduledChange = null,
  disabled = false,
  billingVisibility = "visible",
  commercialOffer = null,
  canSelfServe = true,
  organizationName = null,
}: Props) {
  const customOfferOnly = billingVisibility === "custom_offer_only" && Boolean(commercialOffer);
  const [cycle, setCycle] = useState<Exclude<BillingCycle, "lifetime">>(() => {
    if (customOfferOnly && commercialOffer) {
      if (commercialOffer.allowedCycles.includes("yearly") && currentCycle === "yearly") {
        return "yearly";
      }
      if (commercialOffer.allowedCycles.includes("monthly") && currentCycle === "monthly") {
        return "monthly";
      }
      return commercialOffer.allowedCycles.includes("yearly") ? "yearly" : "monthly";
    }
    return currentCycle === "yearly" ? "yearly" : "monthly";
  });
  const [pendingPlan, setPendingPlan] = useState<PlanKey | null>(null);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [dialogPlan, setDialogPlan] = useState<PlanDefinition | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const startCheckout = useAction(api.billing.startCheckout);
  const scheduleDowngrade = useAction(api.billing.scheduleDowngrade);
  const acceptOffer = useMutation(api.commercialOffers.acceptOffer);
  const me = useQuery(api.users.me, online ? {} : "skip");
  const catalog = useQuery(api.billing.catalog, online ? {} : "skip");

  const catalogPlans: PlanDefinition[] =
    catalog?.plans.map((plan) => {
      const seed = resolvePlan(plan.key);
      return {
        ...seed,
        key: plan.key,
        name: plan.name,
        tagline: plan.tagline,
        audience: plan.audience,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        oneTimePrice: plan.oneTimePrice,
        priceFrom: plan.priceFrom,
        isLifetime: plan.isLifetime,
        featured: plan.featured,
        selfServe: plan.selfServe,
        marketingVisible: true,
        homepageHighlight: false,
        limits: plan.limits,
        features: plan.features,
      };
    }) ?? SELLABLE_PLAN_LIST;

  const listPrices = new Map(
    (catalog?.plans ?? []).map((plan) => [
      plan.key,
      { monthly: plan.listMonthlyPrice, yearly: plan.listYearlyPrice },
    ]),
  );

  const plans: PlanDefinition[] =
    customOfferOnly && commercialOffer
      ? [offerAsPlanDefinition(commercialOffer)]
      : catalogPlans;
  const cycleOptions: Array<"monthly" | "yearly"> =
    customOfferOnly && commercialOffer
      ? commercialOffer.allowedCycles.filter(
          (c): c is "monthly" | "yearly" => c === "monthly" || c === "yearly",
        )
      : ["monthly", "yearly"];

  const offerCyclePrice =
    customOfferOnly && commercialOffer ? offerPriceForCycle(commercialOffer, cycle) : null;
  const offerCanPay = customOfferOnly && offerCyclePrice !== null && offerCyclePrice > 0;

  const dialogCycle: BillingCycle = dialogPlan?.isLifetime ? "lifetime" : cycle;
  const preview = useAuthedQuery(
    api.billing.previewPlanChange,
    dialogPlan && online ? { planKey: dialogPlan.key, cycle: dialogCycle } : "skip",
  );

  async function confirmChange() {
    if (!dialogPlan) return;
    if (!preview) return;
    const chosenCycle: BillingCycle = dialogPlan.isLifetime ? "lifetime" : cycle;
    setPendingPlan(dialogPlan.key);
    try {
      if (customOfferOnly && commercialOffer) {
        try {
          await acceptOffer({ offerId: commercialOffer.id as Id<"commercialOffers"> });
        } catch {
          // Already accepted — checkout may still proceed.
        }
      }
      if (preview.intent === "downgrade") {
        const result = await scheduleDowngrade({
          planKey: dialogPlan.key,
          cycle: chosenCycle,
        });
        toast.success(`Your downgrade is scheduled for ${formatDate(result.effectiveAt)}.`);
        setDialogPlan(null);
        return;
      }
      if (me?.emailVerified === false) {
        setDialogPlan(null);
        setVerifyOpen(true);
        toast.error("Verify your email before starting a payment.");
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

  function onContactOffer() {
    if (!commercialOffer) return;
    void openMailto(offerContactMailto(commercialOffer, organizationName));
  }

  function onChoose(plan: PlanDefinition) {
    if (!online) {
      setOfflineOpen(true);
      return;
    }
    if (customOfferOnly && commercialOffer) {
      if (!offerCanPay) {
        onContactOffer();
        return;
      }
      const kind = planChangeKind(currentPlanKey, plan.key);
      if (kind === "same" && accessState === "active" && !scheduledChange) {
        onContactOffer();
        return;
      }
      setDialogPlan(plan);
      return;
    }
    if (!canSelfServe) return;
    const kind = planChangeKind(currentPlanKey, plan.key);
    if (kind === "same" && accessState === "active" && !plan.isLifetime && !scheduledChange) {
      return;
    }
    setDialogPlan(plan);
  }

  function customOfferLabel(plan: PlanDefinition): string {
    if (!offerCanPay) return "Contact Novend";
    const kind = planChangeKind(currentPlanKey, plan.key);
    if (kind === "same" && accessState === "active" && !scheduledChange) {
      return "Contact Novend";
    }
    if (accessState === "grace" || accessState === "expired") return "Renew now";
    if (accessState === "trial") return "Pay now";
    return "Pay now";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">
            {customOfferOnly ? "Your Novend plan" : "Available plans"}
          </h3>
          {customOfferOnly && commercialOffer?.customerMessage ? (
            <p className="text-muted-foreground mt-1 text-sm">{commercialOffer.customerMessage}</p>
          ) : null}
        </div>
        {cycleOptions.length > 1 ? (
          <div
            className="border-border bg-muted/40 inline-flex rounded-lg border p-1"
            role="group"
            aria-label="Billing cycle"
          >
            {cycleOptions.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={cycle === option}
                onClick={() => setCycle(option)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  cycle === option
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option === "monthly" ? "Monthly" : "Annual"}
                {option === "yearly" && !customOfferOnly ? (
                  <span className="text-primary ml-1.5 text-xs font-semibold">2 months free</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {currentPlanKey === "lifetime" && !customOfferOnly ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          Your organization is on a legacy Lifetime licence. Lifetime is no longer sold; you can
          keep it or move to a Monthly or Annual subscription below.
        </p>
      ) : null}

      <div
        className={cn(
          "grid gap-4",
          customOfferOnly ? "md:grid-cols-1 xl:max-w-md" : "md:grid-cols-2 xl:grid-cols-3",
        )}
      >
        {plans.map((plan) => {
          const kind = planChangeKind(currentPlanKey, plan.key);
          const isCurrentPaid =
            kind === "same" && accessState === "active" && !plan.isLifetime && !scheduledChange;
          const catalogDisabled =
            disabled ||
            pendingPlan !== null ||
            isCurrentPaid ||
            (!canSelfServe && !customOfferOnly);
          const offerDisabled = disabled || pendingPlan !== null;
          const list = listPrices.get(plan.key);
          const listAmount =
            customOfferOnly || !list
              ? null
              : cycle === "yearly"
                ? list.yearly
                : list.monthly;
          return (
            <PlanCard
              key={customOfferOnly && commercialOffer ? `offer-${commercialOffer.id}` : plan.key}
              plan={plan}
              cycle={cycle}
              listAmount={listAmount}
              isCurrent={kind === "same"}
              scheduled={scheduledChange?.targetPlanKey === plan.key}
              scheduledDate={
                scheduledChange?.targetPlanKey === plan.key ? scheduledChange.effectiveAt : null
              }
              label={
                customOfferOnly
                  ? customOfferLabel(plan)
                  : actionLabel(plan, currentPlanKey, accessState, scheduledChange)
              }
              pending={pendingPlan === plan.key}
              disabled={customOfferOnly ? offerDisabled : catalogDisabled}
              onlinePaymentsEnabled={onlinePaymentsEnabled || customOfferOnly}
              onChoose={() => onChoose(plan)}
              secondaryAction={
                customOfferOnly && commercialOffer && offerCanPay
                  ? { label: "Contact Novend", onClick: onContactOffer }
                  : null
              }
            />
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Purchases are subject to the{" "}
        <a href="/terms" className="text-primary underline-offset-2 hover:underline">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/refund" className="text-primary underline-offset-2 hover:underline">
          Refund &amp; Cancellation Policy
        </a>
        .
      </p>

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
      <VerifyEmailDialog open={verifyOpen} onOpenChange={setVerifyOpen} />
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
  listAmount = null,
  isCurrent,
  scheduled,
  scheduledDate,
  label,
  pending,
  disabled,
  onlinePaymentsEnabled,
  onChoose,
  secondaryAction = null,
}: {
  plan: PlanDefinition;
  cycle: Exclude<BillingCycle, "lifetime">;
  listAmount?: number | null;
  isCurrent: boolean;
  scheduled: boolean;
  scheduledDate: number | null;
  label: string;
  pending: boolean;
  disabled: boolean;
  onlinePaymentsEnabled: boolean;
  onChoose: () => void;
  secondaryAction?: { label: string; onClick: () => void } | null;
}) {
  const { amount, suffix } = planPrice(plan, cycle);
  const showDrop =
    listAmount != null && amount != null && listAmount > amount && !plan.isLifetime;

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
                Recommended
              </Badge>
            ) : null}
            {plan.isLifetime ? <Badge variant="outline">Lifetime</Badge> : null}
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">{plan.tagline}</p>
        </div>

        <div>
          {showDrop ? (
            <p className="text-muted-foreground text-sm line-through">
              {formatCurrency(listAmount)}
            </p>
          ) : null}
          <p className="text-2xl font-semibold tracking-tight">
            {amount === null ? "Custom" : formatCurrency(amount)}
            {amount !== null && plan.priceFrom ? (
              <span className="text-muted-foreground text-lg font-semibold">+</span>
            ) : null}
          </p>
          <p className="text-muted-foreground text-xs">{amount === null ? "Talk to us" : suffix}</p>
          {showDrop ? (
            <p className="text-primary mt-1 text-xs font-semibold">Price drop</p>
          ) : null}
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

        <div className="space-y-2">
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
          {secondaryAction ? (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground h-auto min-h-10 w-full px-3"
              disabled={disabled}
              onClick={secondaryAction.onClick}
            >
              <Mail className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              {secondaryAction.label}
            </Button>
          ) : null}
        </div>

        {!onlinePaymentsEnabled && plan.selfServe && !disabled ? (
          <p className="text-muted-foreground text-xs">
            Online payments are not configured yet — contact Novend to activate this plan.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
