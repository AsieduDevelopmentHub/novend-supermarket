"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { useConnectivity } from "@/hooks/use-connectivity";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { showError } from "@/lib/errors";
import type { SellablePlanKey } from "@/convex/shared/plans";

const PLAN_OPTIONS: { value: SellablePlanKey; label: string }[] = [
  { value: "basic", label: "Basic" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
];

type OfferFormState = {
  name: string;
  basePlanKey: SellablePlanKey;
  monthlyPrice: string;
  yearlyPrice: string;
  allowMonthly: boolean;
  allowYearly: boolean;
  products: string;
  users: string;
  branches: string;
  devices: string;
  customerMessage: string;
  notesInternal: string;
};

const EMPTY_FORM: OfferFormState = {
  name: "",
  basePlanKey: "pro",
  monthlyPrice: "",
  yearlyPrice: "",
  allowMonthly: true,
  allowYearly: true,
  products: "",
  users: "",
  branches: "",
  devices: "",
  customerMessage: "",
  notesInternal: "",
};

function parseOptionalLimit(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.toLowerCase() === "unlimited" || trimmed === "*") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Limits must be non-negative numbers or unlimited");
  }
  return Math.floor(value);
}

function buildLimitOverrides(form: OfferFormState) {
  const products = parseOptionalLimit(form.products);
  const users = parseOptionalLimit(form.users);
  const branches = parseOptionalLimit(form.branches);
  const devices = parseOptionalLimit(form.devices);
  const limitOverrides: {
    products?: number | null;
    users?: number | null;
    branches?: number | null;
    devices?: number | null;
  } = {};
  if (products !== undefined) limitOverrides.products = products;
  if (users !== undefined) limitOverrides.users = users;
  if (branches !== undefined) limitOverrides.branches = branches;
  if (devices !== undefined) limitOverrides.devices = devices;
  return Object.keys(limitOverrides).length > 0 ? limitOverrides : undefined;
}

function statusVariant(status: string): "success" | "secondary" | "warning" | "outline" {
  if (status === "active" || status === "accepted") return "success";
  if (status === "draft") return "outline";
  if (status === "withdrawn" || status === "expired") return "secondary";
  return "warning";
}

/** Platform Commercial offer tab — private pricing for one organization. */
export function PlatformCommercialPanel({
  organizationId,
  currency,
}: {
  organizationId: Id<"organizations">;
  currency: string;
}) {
  const online = useConnectivity();
  const offers = useQuery(
    api.commercialOffers.listForOrganization,
    online ? { organizationId } : "skip",
  );
  const createDraft = useMutation(api.commercialOffers.createDraft);
  const updateOffer = useMutation(api.commercialOffers.update);
  const activateOffer = useMutation(api.commercialOffers.activate);
  const withdrawOffer = useMutation(api.commercialOffers.withdraw);
  const setSubscriptionAmount = useMutation(api.billing.setSubscriptionAmount);
  const assignPlan = useMutation(api.billing.assignPlan);
  const license = useQuery(
    api.billing.organizationLicense,
    online ? { organizationId } : "skip",
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"commercialOffers"> | null>(null);
  const [form, setForm] = useState<OfferFormState>(EMPTY_FORM);
  const [pending, setPending] = useState(false);
  const [confirmActivate, setConfirmActivate] = useState<Id<"commercialOffers"> | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState<Id<"commercialOffers"> | null>(null);
  const [applyPricingOpen, setApplyPricingOpen] = useState(false);
  const [pendingApplyAmount, setPendingApplyAmount] = useState<number | null>(null);
  const [pendingApplyCycle, setPendingApplyCycle] = useState<"monthly" | "yearly">("monthly");
  const [pendingApplyPlanKey, setPendingApplyPlanKey] = useState<SellablePlanKey>("pro");

  if (!online && offers === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Commercial offer</CardTitle>
          <CardDescription>Commercial offers need a connection.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (offers === undefined) {
    return <LoadingState label="Loading commercial offers…" variant="form" />;
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  }

  function openEdit(offer: Doc<"commercialOffers">) {
    setEditingId(offer._id);
    setForm({
      name: offer.name,
      basePlanKey: offer.basePlanKey,
      monthlyPrice: offer.monthlyPrice !== undefined ? String(offer.monthlyPrice) : "",
      yearlyPrice: offer.yearlyPrice !== undefined ? String(offer.yearlyPrice) : "",
      allowMonthly: offer.allowedCycles.includes("monthly"),
      allowYearly: offer.allowedCycles.includes("yearly"),
      products:
        offer.limitOverrides?.products === null
          ? "unlimited"
          : offer.limitOverrides?.products !== undefined
            ? String(offer.limitOverrides.products)
            : "",
      users:
        offer.limitOverrides?.users === null
          ? "unlimited"
          : offer.limitOverrides?.users !== undefined
            ? String(offer.limitOverrides.users)
            : "",
      branches:
        offer.limitOverrides?.branches === null
          ? "unlimited"
          : offer.limitOverrides?.branches !== undefined
            ? String(offer.limitOverrides.branches)
            : "",
      devices:
        offer.limitOverrides?.devices === null
          ? "unlimited"
          : offer.limitOverrides?.devices !== undefined
            ? String(offer.limitOverrides.devices)
            : "",
      customerMessage: offer.customerMessage ?? "",
      notesInternal: offer.notesInternal ?? "",
    });
    setDialogOpen(true);
  }

  async function onSaveForm() {
    if (!online) {
      toast.error("Commercial offers require a connection");
      return;
    }
    const allowedCycles: Array<"monthly" | "yearly"> = [];
    if (form.allowMonthly) allowedCycles.push("monthly");
    if (form.allowYearly) allowedCycles.push("yearly");
    if (allowedCycles.length === 0) {
      toast.error("Select at least one billing cycle");
      return;
    }

    setPending(true);
    try {
      const monthlyPrice = form.allowMonthly ? Number(form.monthlyPrice) : undefined;
      const yearlyPrice = form.allowYearly ? Number(form.yearlyPrice) : undefined;
      if (form.allowMonthly && !Number.isFinite(monthlyPrice)) {
        throw new Error("Enter a valid monthly price");
      }
      if (form.allowYearly && !Number.isFinite(yearlyPrice)) {
        throw new Error("Enter a valid yearly price");
      }
      const limitOverrides = buildLimitOverrides(form);

      let savedLiveOffer = false;
      if (editingId) {
        const existing = offers?.find((row) => row._id === editingId);
        await updateOffer({
          offerId: editingId,
          name: form.name.trim(),
          basePlanKey: form.basePlanKey,
          monthlyPrice,
          yearlyPrice,
          allowedCycles,
          limitOverrides: limitOverrides ?? null,
          customerMessage: form.customerMessage.trim() || null,
          notesInternal: form.notesInternal.trim() || null,
        });
        savedLiveOffer = existing?.status === "active" || existing?.status === "accepted";
        toast.success("Offer updated");
      } else {
        await createDraft({
          organizationId,
          name: form.name.trim(),
          basePlanKey: form.basePlanKey,
          currency,
          monthlyPrice,
          yearlyPrice,
          allowedCycles,
          limitOverrides,
          customerMessage: form.customerMessage.trim() || undefined,
          notesInternal: form.notesInternal.trim() || undefined,
        });
        toast.success("Draft offer created");
      }
      setDialogOpen(false);

      const sub = license?.subscription;
      const canApply =
        savedLiveOffer &&
        sub &&
        !sub.isLifetime &&
        (sub.status === "active" || sub.status === "past_due" || sub.status === "trialing");
      if (canApply && sub) {
        const cycle =
          sub.billingCycle === "yearly" && allowedCycles.includes("yearly")
            ? "yearly"
            : allowedCycles.includes("monthly")
              ? "monthly"
              : allowedCycles[0]!;
        const amount = cycle === "yearly" ? yearlyPrice : monthlyPrice;
        if (typeof amount === "number" && Number.isFinite(amount)) {
          setPendingApplyAmount(amount);
          setPendingApplyCycle(cycle);
          setPendingApplyPlanKey(form.basePlanKey);
          setApplyPricingOpen(true);
        }
      }
    } catch (error) {
      showError(error, "Save failed");
    } finally {
      setPending(false);
    }
  }

  async function onActivate(offerId: Id<"commercialOffers">) {
    setPending(true);
    try {
      await activateOffer({ offerId });
      toast.success("Offer activated");
      setConfirmActivate(null);
      const offer = offers?.find((row) => row._id === offerId);
      const sub = license?.subscription;
      if (
        offer &&
        sub &&
        !sub.isLifetime &&
        (sub.status === "active" || sub.status === "past_due" || sub.status === "trialing")
      ) {
        const cycle =
          sub.billingCycle === "yearly" && offer.allowedCycles.includes("yearly")
            ? "yearly"
            : offer.allowedCycles.includes("monthly")
              ? "monthly"
              : offer.allowedCycles[0]!;
        const amount = cycle === "yearly" ? offer.yearlyPrice : offer.monthlyPrice;
        if (typeof amount === "number") {
          setPendingApplyAmount(amount);
          setPendingApplyCycle(cycle);
          setPendingApplyPlanKey(offer.basePlanKey);
          setApplyPricingOpen(true);
        }
      }
    } catch (error) {
      showError(error, "Activate failed");
    } finally {
      setPending(false);
    }
  }

  async function onWithdraw(offerId: Id<"commercialOffers">) {
    setPending(true);
    try {
      await withdrawOffer({ offerId });
      toast.success("Offer withdrawn");
      setConfirmWithdraw(null);
    } catch (error) {
      showError(error, "Withdraw failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Commercial offer</CardTitle>
            <CardDescription>
              Negotiated monthly/annual charges and limits. Saving an offer does not change MRR,
              ARR, or gross by itself — after save you will confirm whether to update the live
              licence amount only or also record a payment.
            </CardDescription>
          </div>
          <Button type="button" size="sm" disabled={!online} onClick={openCreate}>
            New draft
          </Button>
        </CardHeader>
        <CardContent>
          {offers.length === 0 ? (
            <EmptyState
              title="No commercial offers"
              description="Create a draft offer with negotiated prices for this organization."
            />
          ) : (
            <div className="space-y-3">
              {offers.map((offer) => (
                <div
                  key={offer._id}
                  className="border-border flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{offer.name}</p>
                      <Badge variant={statusVariant(offer.status)}>{offer.status}</Badge>
                      <Badge variant="outline">{offer.basePlanKey}</Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {offer.allowedCycles.includes("monthly") && offer.monthlyPrice !== undefined
                        ? `Monthly ${formatCurrency(offer.monthlyPrice)}`
                        : null}
                      {offer.allowedCycles.includes("monthly") &&
                      offer.allowedCycles.includes("yearly")
                        ? " · "
                        : null}
                      {offer.allowedCycles.includes("yearly") && offer.yearlyPrice !== undefined
                        ? `Annual ${formatCurrency(offer.yearlyPrice)}`
                        : null}
                    </p>
                    {offer.customerMessage ? (
                      <p className="text-sm">{offer.customerMessage}</p>
                    ) : null}
                    {offer.notesInternal ? (
                      <p className="text-muted-foreground text-xs">
                        Internal: {offer.notesInternal}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground text-xs">
                      Updated {formatDateTime(offer.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(offer.status === "draft" || offer.status === "active") && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!online || pending}
                        onClick={() => openEdit(offer)}
                      >
                        Edit
                      </Button>
                    )}
                    {(offer.status === "draft" || offer.status === "withdrawn") && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={!online || pending}
                        onClick={() => setConfirmActivate(offer._id)}
                      >
                        Activate
                      </Button>
                    )}
                    {(offer.status === "draft" || offer.status === "active") && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!online || pending}
                        onClick={() => setConfirmWithdraw(offer._id)}
                      >
                        Withdraw
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit offer" : "Create draft offer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="offer-name">Name</Label>
              <Input
                id="offer-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Negotiated Pro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offer-plan">Base plan</Label>
              <Select
                value={form.basePlanKey}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, basePlanKey: value as SellablePlanKey }))
                }
              >
                <SelectTrigger id="offer-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.allowMonthly}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, allowMonthly: checked === true }))
                  }
                />
                Monthly
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.allowYearly}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, allowYearly: checked === true }))
                  }
                />
                Annual
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                  <Label htmlFor="offer-monthly">Monthly charge ({currency})</Label>
                <Input
                  id="offer-monthly"
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!form.allowMonthly}
                  value={form.monthlyPrice}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, monthlyPrice: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="offer-yearly">Annual charge ({currency})</Label>
                <Input
                  id="offer-yearly"
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!form.allowYearly}
                  value={form.yearlyPrice}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, yearlyPrice: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["products", "Products"],
                  ["users", "Users"],
                  ["branches", "Branches"],
                  ["devices", "Devices"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`offer-${key}`}>{label} limit</Label>
                  <Input
                    id={`offer-${key}`}
                    value={form[key]}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, [key]: event.target.value }))
                    }
                    placeholder="Number or unlimited"
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="offer-customer-message">Customer message</Label>
              <Textarea
                id="offer-customer-message"
                value={form.customerMessage}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, customerMessage: event.target.value }))
                }
                placeholder="Configured for your business…"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offer-notes">Internal notes (platform only)</Label>
              <Textarea
                id="offer-notes"
                value={form.notesInternal}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, notesInternal: event.target.value }))
                }
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !form.name.trim()}
              onClick={() => void onSaveForm()}
            >
              {editingId ? "Save changes" : "Create draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={applyPricingOpen}
        onOpenChange={(open) => {
          setApplyPricingOpen(open);
          if (!open) {
            setPendingApplyAmount(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply offer price to the live licence?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Offer prices are saved. Recognized MRR uses the licence amount
                  {license?.subscription
                    ? ` (currently ${formatCurrency(license.subscription.amount)})`
                    : ""}
                  .
                </p>
                <p>
                  New amount:{" "}
                  {pendingApplyAmount !== null ? formatCurrency(pendingApplyAmount) : "—"} /{" "}
                  {pendingApplyCycle}. Choose whether this should only update recurring MRR or
                  also record a payment (gross / net profit).
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              disabled={pending || pendingApplyAmount === null}
              onClick={() => {
                if (pendingApplyAmount === null) return;
                const samePlanAndCycle =
                  license?.subscription?.planKey === pendingApplyPlanKey &&
                  license.subscription.billingCycle === pendingApplyCycle;
                setPending(true);
                const work = samePlanAndCycle
                  ? setSubscriptionAmount({
                      organizationId,
                      amount: pendingApplyAmount,
                    })
                  : assignPlan({
                      organizationId,
                      planKey: pendingApplyPlanKey,
                      cycle: pendingApplyCycle,
                      amount: pendingApplyAmount,
                      recordPayment: false,
                    });
                void work
                  .then(() => {
                    toast.success("Licence amount updated (no new payment)");
                    setApplyPricingOpen(false);
                    setPendingApplyAmount(null);
                  })
                  .catch((error) => showError(error, "Update failed"))
                  .finally(() => setPending(false));
              }}
            >
              Update amount only (no new payment)
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending || pendingApplyAmount === null}
              onClick={() => {
                if (pendingApplyAmount === null) return;
                setPending(true);
                void assignPlan({
                  organizationId,
                  planKey: pendingApplyPlanKey,
                  cycle: pendingApplyCycle,
                  amount: pendingApplyAmount,
                  recordPayment: true,
                })
                  .then(() => {
                    toast.success("Payment recorded and licence updated");
                    setApplyPricingOpen(false);
                    setPendingApplyAmount(null);
                  })
                  .catch((error) => showError(error, "Assign failed"))
                  .finally(() => setPending(false));
              }}
            >
              Apply and record a payment
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setApplyPricingOpen(false);
                setPendingApplyAmount(null);
                toast.message("Offer saved without changing MRR or gross");
              }}
            >
              Leave licence unchanged
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmActivate !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmActivate(null);
        }}
        title="Activate commercial offer?"
        description="Any other active or accepted offer for this organization will be withdrawn."
        confirmLabel="Activate"
        confirmVariant="default"
        onConfirm={() => {
          if (confirmActivate) void onActivate(confirmActivate);
        }}
      />
      <ConfirmDialog
        open={confirmWithdraw !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmWithdraw(null);
        }}
        title="Withdraw commercial offer?"
        description="The organization will no longer see this private offer."
        confirmLabel="Withdraw"
        confirmVariant="destructive"
        onConfirm={() => {
          if (confirmWithdraw) void onWithdraw(confirmWithdraw);
        }}
      />
    </div>
  );
}
