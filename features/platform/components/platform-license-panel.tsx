"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import { LoadingState } from "@/components/feedback/loading-state";
import {
  GIBIBYTE,
  MAX_CUSTOM_BACKUP_GB,
  PLAN_CATALOG,
  PLAN_LIST,
  SELLABLE_PLAN_LIST,
  RESOURCE_LABELS,
  supportsCycle,
  type BillingCycle,
  type LimitResource,
  type PlanKey,
} from "@/convex/shared/plans";
import { formatCurrency, formatNumber } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { showError } from "@/lib/errors";
import { PlanUsageGrid } from "@/features/billing/components/plan-usage-grid";
import { useConnectivity } from "@/hooks/use-connectivity";
import { derivedMaxImportRows } from "@/convex/shared/capabilities";
import type { OrgImportExportSnapshot } from "@/convex/shared/importExportSnapshot";
import { PlatformImportExportCard } from "./platform-import-export-card";
import { formatClosureReason } from "@/convex/shared/accountClosure";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";
import type { CloudMode } from "@/convex/shared/cloudMode";

const CLOUD_MODE_OPTIONS: { value: CloudMode; label: string; hint: string }[] = [
  { value: "full_sync", label: "Full sync", hint: "Realtime cloud sync and backups" },
  { value: "backup_only", label: "Backup only", hint: "Scheduled cloud backups, no realtime sync" },
  { value: "local_only", label: "Local only", hint: "Device-only — stops cloud sync" },
];

type LimitOverrides = {
  products?: number | null;
  users?: number | null;
  branches?: number | null;
  devices?: number | null;
} | null;

const ORGANIZATION_STATUSES = [
  { value: "active", label: "Active", hint: "Full access" },
  { value: "trial", label: "Trial", hint: "Full access until the trial ends" },
  { value: "suspended", label: "Suspended", hint: "Read-only" },
  { value: "expired", label: "Expired", hint: "Read-only" },
  { value: "disabled", label: "Disabled", hint: "No access at all" },
] as const;

type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number]["value"];

/** `inactive` is the pre-billing name for a fully blocked account. */
function normalizeStatus(status: OrganizationStatus | "inactive"): OrganizationStatus {
  return status === "inactive" ? "disabled" : status;
}

const CYCLES: { value: BillingCycle; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Annual" },
];

/** Cycles offered for new assignments. Lifetime is legacy-only. */
function assignableCycles(planKey: PlanKey): { value: BillingCycle; label: string }[] {
  const plan = PLAN_CATALOG[planKey];
  if (plan?.isLifetime) {
    return [{ value: "lifetime", label: "Lifetime (legacy)" }];
  }
  return CYCLES.filter((option) => supportsCycle(plan, option.value));
}

/** Plans offered for new assignment — Lifetime only when the org already holds it. */
function assignablePlans(currentPlanKey: PlanKey | null | undefined) {
  if (currentPlanKey === "lifetime") {
    return PLAN_LIST;
  }
  return SELLABLE_PLAN_LIST;
}

/** Super-admin licence controls for a single organization. */
export function PlatformLicensePanel({
  organizationId,
  organizationName,
  status,
  limitOverrides,
  productImagesEnabled = true,
  importExport,
  pendingClosure = false,
  closureEffectiveAt = null,
  closureReason = null,
}: {
  organizationId: Id<"organizations">;
  organizationName: string;
  status: OrganizationStatus | "inactive";
  limitOverrides: LimitOverrides;
  productImagesEnabled?: boolean;
  importExport?: OrgImportExportSnapshot | null;
  pendingClosure?: boolean;
  closureEffectiveAt?: number | null;
  closureReason?: string | null;
}) {
  const online = useConnectivity();
  const license = useQuery(api.billing.organizationLicense, online ? { organizationId } : "skip");
  const assignPlan = useMutation(api.billing.assignPlan);
  const setSubscriptionAmount = useMutation(api.billing.setSubscriptionAmount);
  const startTrial = useMutation(api.billing.startTrial);
  const resetActivation = useMutation(api.billing.resetActivation);
  const setBackupLimit = useMutation(api.billing.setBackupLimit);
  const setStatus = useMutation(api.platform.setOrganizationStatus);
  const setCloudMode = useMutation(api.platform.setOrganizationCloudMode);
  const setLimitOverrides = useMutation(api.platform.setOrganizationLimitOverrides);
  const setProductImagesEnabled = useMutation(api.platform.setProductImagesEnabled);
  const extendSubscription = useMutation(api.platform.extendSubscription);
  const archiveOrganization = useMutation(api.platform.archiveOrganization);

  const [planKey, setPlanKey] = useState<PlanKey>("pro");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [chargeAmount, setChargeAmount] = useState("");
  const [note, setNote] = useState("");
  const [extendDays, setExtendDays] = useState("30");
  const [pending, setPending] = useState(false);
  const [assignChoiceOpen, setAssignChoiceOpen] = useState(false);
  const [pendingAssignAmount, setPendingAssignAmount] = useState<number | undefined>(undefined);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmArchiveName, setConfirmArchiveName] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [confirmLocalOnly, setConfirmLocalOnly] = useState(false);
  /** Optimistic toggle scoped to the open org — avoids syncing props via an effect. */
  const [imagesDraft, setImagesDraft] = useState<{
    organizationId: Id<"organizations">;
    enabled: boolean;
  } | null>(null);
  const imagesEnabled =
    imagesDraft?.organizationId === organizationId ? imagesDraft.enabled : productImagesEnabled;

  if (!online && license === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Licence</CardTitle>
          <CardDescription>
            Licence and billing controls need a connection. Status badge above reflects the last
            cached organization status.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (license === undefined) return <LoadingState label="Loading licence…" variant="form" />;
  if (license === null) return null;

  const selectedPlan = PLAN_LIST.find((plan) => plan.key === planKey);
  const cycleOptions = assignableCycles(planKey);
  const cycleAllowed = selectedPlan ? supportsCycle(selectedPlan, cycle) : false;
  const plansForAssignment = assignablePlans(license.planKey);

  async function run(label: string, work: () => Promise<unknown>): Promise<boolean> {
    if (!online) {
      toast.error("Licence and status changes require a connection");
      return false;
    }
    setPending(true);
    try {
      await work();
      toast.success(label);
      return true;
    } catch (error) {
      showError(error, "Action failed");
      return false;
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {pendingClosure && closureEffectiveAt ? (
        <Alert className="border-destructive/40 bg-destructive/5">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          <AlertTitle>Self-service closure in progress</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>
              Owner scheduled permanent closure for{" "}
              <strong>{formatDateTime(closureEffectiveAt)}</strong>. Account status is read-only
              until then.
            </p>
            {closureReason ? (
              <p>Reason: {formatClosureReason(closureReason) ?? closureReason}</p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      <PlatformImportExportCard snapshot={importExport} />
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Licence
            <Badge variant="outline">{license.planName}</Badge>
            <Badge variant={license.access.canWrite ? "success" : "warning"}>
              {license.access.state}
            </Badge>
          </CardTitle>
          <CardDescription>
            {license.subscription
              ? license.subscription.isLifetime
                ? `Lifetime licence since ${formatDateTime(license.subscription.startsAt)}`
                : `${formatCurrency(license.subscription.amount)} ${license.subscription.billingCycle} · renews ${
                    license.subscription.nextBillingDate
                      ? formatDateTime(license.subscription.nextBillingDate)
                      : "—"
                  }`
              : license.trialEndsAt
                ? `Trial ends ${formatDateTime(license.trialEndsAt)}`
                : "No subscription on record."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <PlanUsageGrid usage={license.usage} />

          {license.variableBackup ? (
            <EnterpriseBackupQuota
              key={organizationId}
              currentBytes={license.backupLimitBytes}
              disabled={pending || !online}
              onSave={(backupLimitGb) =>
                void run(
                  backupLimitGb === null
                    ? "Cloud backup cap removed"
                    : `Cloud backup set to ${backupLimitGb} GB`,
                  () => setBackupLimit({ organizationId, backupLimitGb }),
                )
              }
            />
          ) : (
            <p className="text-muted-foreground text-xs">
              Cloud backup follows the published plan. Assign Enterprise to set a custom quota.
            </p>
          )}

          <LimitOverridesEditor
            key={`${organizationId}-${JSON.stringify(limitOverrides)}-${license.entitlementVersion}`}
            overrides={limitOverrides}
            effectiveLimits={license.usage}
            catalogProductLimit={
              PLAN_LIST.find((plan) => plan.key === license.planKey)?.limits.products ?? null
            }
            allowedCloudModes={license.allowedCloudModes}
            cloudBackupEnabled={license.cloudBackupEnabled}
            remoteMonitoringEnabled={license.remoteMonitoringEnabled}
            disabled={pending || !online}
            onSave={(payload) =>
              void run("Resource limits updated", () =>
                setLimitOverrides({ organizationId, ...payload }),
              )
            }
          />

          <div className="border-border space-y-3 rounded-lg border p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Product images</p>
              <p className="text-muted-foreground text-xs">
                When disabled, staff cannot upload or capture new product photos. Existing images
                remain visible and can still be removed. Organization admins can also change this in
                Settings.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="platform-product-images" className="text-sm font-normal">
                Allow product image uploads
              </Label>
              <Switch
                id="platform-product-images"
                checked={imagesEnabled}
                disabled={pending || !online}
                onCheckedChange={(checked) => {
                  const previous = imagesEnabled;
                  setImagesDraft({ organizationId, enabled: checked });
                  void run(
                    checked ? "Product image uploads enabled" : "Product image uploads disabled",
                    () => setProductImagesEnabled({ organizationId, enabled: checked }),
                  ).then((ok) => {
                    if (!ok) setImagesDraft({ organizationId, enabled: previous });
                  });
                }}
              />
            </div>
          </div>

          <div className="border-border space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Extend subscription</p>
            <p className="text-muted-foreground text-xs">
              Adds days to the current expiry (or trial end, if there is no paid subscription yet).
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-32 space-y-2">
                <Label htmlFor="extend-days">Days</Label>
                <Input
                  id="extend-days"
                  type="number"
                  min={1}
                  max={3650}
                  inputMode="numeric"
                  value={extendDays}
                  onChange={(event) => setExtendDays(event.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={pending || !online}
                onClick={() => {
                  const days = Number(extendDays);
                  if (!Number.isInteger(days) || days <= 0) {
                    toast.error("Enter a whole number of days");
                    return;
                  }
                  void run(`Extended by ${days} days`, () =>
                    extendSubscription({ organizationId, days }),
                  );
                }}
              >
                Extend
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="license-status">Account status</Label>
              <Select
                value={normalizeStatus(status)}
                disabled={pending || !online}
                onValueChange={(value) =>
                  void run("Status updated", () =>
                    setStatus({ organizationId, status: value as OrganizationStatus }),
                  )
                }
              >
                <SelectTrigger id="license-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORGANIZATION_STATUSES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label} — {option.hint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Device activations</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={pending || !online}
                onClick={() => setConfirmReset(true)}
              >
                Reset activation
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="license-cloud-mode">Cloud mode</Label>
            <Select
              value={license.cloudMode}
              disabled={pending || !online}
              onValueChange={(value) => {
                const nextMode = value as CloudMode;
                if (nextMode === license.cloudMode) return;
                if (nextMode === "local_only") {
                  setConfirmLocalOnly(true);
                  return;
                }
                void run("Cloud mode updated", () =>
                  setCloudMode({ organizationId, cloudMode: nextMode }),
                );
              }}
            >
              <SelectTrigger id="license-cloud-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLOUD_MODE_OPTIONS.filter((option) =>
                  license.allowedCloudModes.includes(option.value),
                ).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} — {option.hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {license.allowedCloudModes.length < CLOUD_MODE_OPTIONS.length
                ? "Some cloud modes are restricted for this organization. "
                : ""}
              Entitlement version {license.entitlementVersion}.
            </p>
          </div>

          <div className="border-border space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Assign a plan</p>
            {license.planKey === "lifetime" ? (
              <p className="text-muted-foreground text-xs leading-relaxed">
                This organization is on a legacy Lifetime licence. You can keep Lifetime selected
                or migrate them to a sellable Monthly/Annual plan.
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="license-plan">Plan</Label>
                <Select
                  value={planKey}
                  onValueChange={(value) => {
                    const next = value as PlanKey;
                    setPlanKey(next);
                    const nextCycles = assignableCycles(next);
                    if (!nextCycles.some((option) => option.value === cycle)) {
                      setCycle(nextCycles[0]?.value ?? "monthly");
                    }
                  }}
                >
                  <SelectTrigger id="license-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {plansForAssignment.map((plan) => (
                      <SelectItem key={plan.key} value={plan.key}>
                        {plan.name}
                        {plan.legacy ? " (legacy)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="license-cycle">Billing cycle</Label>
                <Select value={cycle} onValueChange={(value) => setCycle(value as BillingCycle)}>
                  <SelectTrigger id="license-cycle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cycleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="license-amount">Charge amount (optional)</Label>
              <Input
                id="license-amount"
                type="number"
                min={0}
                step="0.01"
                value={chargeAmount}
                onChange={(event) => setChargeAmount(event.target.value)}
                placeholder="Blank = commercial offer or catalog price"
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                For discounts, premiums, enterprise quotes, or later price increases. Empty uses
                the live commercial offer or catalog. If a subscription already exists, you must
                confirm whether to update the recurring amount only or also record a payment.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="license-note">Note for the billing record</Label>
              <Input
                id="license-note"
                value={note}
                maxLength={120}
                placeholder="e.g. Paid by bank transfer, invoice 0142"
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            {!cycleAllowed ? (
              <p className="text-muted-foreground text-xs">
                {selectedPlan?.name} is not sold on a {cycle} cycle.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending || !online || !cycleAllowed}
                onClick={() => {
                  const trimmed = chargeAmount.trim();
                  let amount: number | undefined;
                  if (trimmed) {
                    amount = Number(trimmed);
                    if (!Number.isFinite(amount) || amount < 0) {
                      toast.error("Enter a valid charge amount");
                      return;
                    }
                  }
                  const hasActiveSubscription =
                    Boolean(license.subscription) &&
                    !license.subscription?.isLifetime &&
                    (license.subscription?.status === "active" ||
                      license.subscription?.status === "past_due");
                  if (hasActiveSubscription) {
                    setPendingAssignAmount(amount);
                    setAssignChoiceOpen(true);
                    return;
                  }
                  void run("Plan assigned", () =>
                    assignPlan({
                      organizationId,
                      planKey,
                      cycle,
                      note: note.trim() || undefined,
                      amount,
                    }),
                  );
                }}
              >
                Assign plan
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending || !online}
                onClick={() =>
                  void run("Trial started", () => startTrial({ organizationId, planKey }))
                }
              >
                Start trial
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent payments</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {license.payments.length === 0 ? (
            <p className="text-muted-foreground text-sm">No payments recorded yet.</p>
          ) : (
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium">Gateway</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {license.payments.map((payment) => (
                  <tr key={payment.id} className="border-border border-t">
                    <td className="py-2">{formatDateTime(payment.createdAt)}</td>
                    <td className="py-2">
                      <p>{payment.description}</p>
                      <p className="text-muted-foreground text-xs">{payment.reference}</p>
                    </td>
                    <td className="py-2 capitalize">{payment.gateway}</td>
                    <td className="py-2 text-right">{formatCurrency(payment.amount)}</td>
                    <td className="py-2">
                      <Badge
                        variant={
                          payment.status === "success"
                            ? "success"
                            : payment.status === "pending"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {payment.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Archives the organization instead of permanently deleting its records — every device is
            deactivated and access is fully blocked. Reactivate later from Account status above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="destructive"
            disabled={pending || !online || status === "disabled"}
            onClick={() => setArchiveOpen(true)}
          >
            Delete organization
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={assignChoiceOpen}
        onOpenChange={(open) => {
          setAssignChoiceOpen(open);
          if (!open) setPendingAssignAmount(undefined);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {license.subscription &&
              pendingAssignAmount !== undefined &&
              pendingAssignAmount > license.subscription.amount
                ? "Increase recurring amount?"
                : license.subscription &&
                    pendingAssignAmount !== undefined &&
                    pendingAssignAmount < license.subscription.amount
                  ? "Decrease recurring amount?"
                  : "How should this amount apply?"}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Current subscription
                  {license.subscription
                    ? `: ${formatCurrency(license.subscription.amount)} / ${license.subscription.billingCycle}`
                    : ""}
                  {pendingAssignAmount !== undefined
                    ? `. New amount: ${formatCurrency(pendingAssignAmount)}.`
                    : ". New amount will use the commercial offer or catalog price."}
                </p>
                <p>
                  Not every change should record a payment. Price increases for the next renewal,
                  discounts, and catalog corrections usually only update the recurring amount.
                  Record a payment only when money was actually collected for this change.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              variant="default"
              disabled={pending}
              onClick={() => {
                const samePlanAndCycle =
                  license.subscription?.planKey === planKey &&
                  license.subscription?.billingCycle === cycle;
                if (samePlanAndCycle) {
                  if (pendingAssignAmount === undefined) {
                    toast.error("Enter the new charge amount first");
                    return;
                  }
                  void run("Recurring amount updated", () =>
                    setSubscriptionAmount({
                      organizationId,
                      amount: pendingAssignAmount,
                      note: note.trim() || undefined,
                    }),
                  ).then((ok) => {
                    if (ok) {
                      setAssignChoiceOpen(false);
                      setPendingAssignAmount(undefined);
                      setChargeAmount("");
                    }
                  });
                  return;
                }
                void run("Plan updated without new payment", () =>
                  assignPlan({
                    organizationId,
                    planKey,
                    cycle,
                    note: note.trim() || undefined,
                    amount: pendingAssignAmount,
                    recordPayment: false,
                  }),
                ).then((ok) => {
                  if (ok) {
                    setAssignChoiceOpen(false);
                    setPendingAssignAmount(undefined);
                    setChargeAmount("");
                  }
                });
              }}
            >
              Update amount only (no new payment)
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                void run("Plan assigned", () =>
                  assignPlan({
                    organizationId,
                    planKey,
                    cycle,
                    note: note.trim() || undefined,
                    amount: pendingAssignAmount,
                    recordPayment: true,
                  }),
                ).then((ok) => {
                  if (ok) {
                    setAssignChoiceOpen(false);
                    setPendingAssignAmount(undefined);
                    setChargeAmount("");
                  }
                });
              }}
            >
              Apply and record a payment
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setAssignChoiceOpen(false);
                setPendingAssignAmount(undefined);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmLocalOnly}
        onOpenChange={setConfirmLocalOnly}
        title="Switch to local-only?"
        description="Cloud sync and scheduled backups stop for this organization. The business keeps operating on-device and Novend still receives the minimal platform heartbeat, but its data will no longer sync to the cloud until you change the mode back."
        confirmLabel="Switch to local only"
        confirmVariant="destructive"
        pending={pending}
        onConfirm={() =>
          void run("Cloud mode updated", () =>
            setCloudMode({ organizationId, cloudMode: "local_only" }),
          ).then(() => setConfirmLocalOnly(false))
        }
      />

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset device activations?"
        description="Every terminal is deactivated. Staff simply sign in again to re-activate, up to the plan limit."
        confirmLabel="Reset activations"
        pending={pending}
        onConfirm={() =>
          void run("Activations reset", () => resetActivation({ organizationId })).then(() =>
            setConfirmReset(false),
          )
        }
      />

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={(open) => {
          setArchiveOpen(open);
          if (!open) setConfirmArchiveName("");
        }}
        title={`Delete ${organizationName}?`}
        description={
          <div className="space-y-2">
            <p>
              This archives the organization, blocks every login, and deactivates every device.
              Business records are retained for audit — nothing is permanently erased.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-archive-name">
                Type <span className="font-semibold">{organizationName}</span> to confirm
              </Label>
              <Input
                id="confirm-archive-name"
                value={confirmArchiveName}
                onChange={(event) => setConfirmArchiveName(event.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        }
        confirmLabel="Delete organization"
        confirmVariant="destructive"
        pending={pending}
        disableConfirm={confirmArchiveName.trim() !== organizationName}
        onConfirm={() =>
          void run("Organization archived", () =>
            archiveOrganization({ organizationId, confirmName: confirmArchiveName }),
          ).then(() => {
            setArchiveOpen(false);
            setConfirmArchiveName("");
          })
        }
      />
    </div>
  );
}

type OverrideResource = "products" | "users" | "branches" | "devices";
const OVERRIDE_RESOURCES: OverrideResource[] = ["products", "users", "branches", "devices"];
type OverrideMode = "default" | "unlimited" | "custom";

function LimitOverridesEditor({
  overrides,
  effectiveLimits,
  catalogProductLimit,
  allowedCloudModes,
  cloudBackupEnabled,
  remoteMonitoringEnabled,
  disabled,
  onSave,
}: {
  overrides: LimitOverrides;
  effectiveLimits: Array<{ resource: LimitResource; limit: number | null }>;
  catalogProductLimit: number | null;
  allowedCloudModes: CloudMode[];
  cloudBackupEnabled: boolean;
  remoteMonitoringEnabled: boolean;
  disabled: boolean;
  onSave: (payload: {
    products?: number | null;
    users?: number | null;
    branches?: number | null;
    devices?: number | null;
    clear?: OverrideResource[];
    allowedCloudModes?: CloudMode[] | null;
    cloudBackupEnabled?: boolean;
    remoteMonitoringEnabled?: boolean;
  }) => void;
}) {
  const [state, setState] = useState<
    Record<OverrideResource, { mode: OverrideMode; value: string }>
  >(
    () =>
      Object.fromEntries(
        OVERRIDE_RESOURCES.map((resource) => {
          const raw = overrides?.[resource];
          if (raw === undefined) return [resource, { mode: "default", value: "" }];
          if (raw === null) return [resource, { mode: "unlimited", value: "" }];
          return [resource, { mode: "custom", value: String(raw) }];
        }),
      ) as Record<OverrideResource, { mode: OverrideMode; value: string }>,
  );
  // An empty allowlist means "all modes allowed"; seed the toggles from that.
  const initialModes =
    allowedCloudModes.length === 0
      ? CLOUD_MODE_OPTIONS.map((option) => option.value)
      : allowedCloudModes;
  const [modes, setModes] = useState<Set<CloudMode>>(() => new Set(initialModes));
  const [backupOn, setBackupOn] = useState(cloudBackupEnabled);
  const [monitoringOn, setMonitoringOn] = useState(remoteMonitoringEnabled);

  const limitByResource = new Map(effectiveLimits.map((row) => [row.resource, row.limit]));

  function toggleMode(mode: CloudMode, checked: boolean) {
    setModes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(mode);
      else next.delete(mode);
      return next;
    });
  }

  function submit() {
    const payload: {
      products?: number | null;
      users?: number | null;
      branches?: number | null;
      devices?: number | null;
      clear: OverrideResource[];
      allowedCloudModes?: CloudMode[] | null;
      cloudBackupEnabled?: boolean;
      remoteMonitoringEnabled?: boolean;
    } = { clear: [] };

    for (const resource of OVERRIDE_RESOURCES) {
      const entry = state[resource];
      if (entry.mode === "default") {
        payload.clear.push(resource);
        continue;
      }
      if (entry.mode === "unlimited") {
        payload[resource] = null;
        continue;
      }
      const parsed = Number(entry.value.trim());
      if (!Number.isInteger(parsed) || parsed <= 0) {
        toast.error(`Enter a whole positive number for ${RESOURCE_LABELS[resource]}.`);
        return;
      }
      payload[resource] = parsed;
    }

    if (modes.size === 0) {
      toast.error("Allow at least one cloud mode.");
      return;
    }
    // All three selected → clear the restriction (null); otherwise send the list.
    payload.allowedCloudModes =
      modes.size === CLOUD_MODE_OPTIONS.length
        ? null
        : CLOUD_MODE_OPTIONS.filter((option) => modes.has(option.value)).map(
            (option) => option.value,
          );
    payload.cloudBackupEnabled = backupOn;
    payload.remoteMonitoringEnabled = monitoringOn;

    onSave(payload);
  }

  return (
    <div className="border-border space-y-3 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Resource limit overrides</p>
        <p className="text-muted-foreground text-xs">
          Overrides win over the plan default for this organization only. Existing records are never
          removed if a lower limit is applied — only new creation is blocked. The product override
          also sets this organization’s import row cap (min of the product limit and 10,000). Excel
          and PDF still follow the assigned plan.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {OVERRIDE_RESOURCES.map((resource) => {
          const entry = state[resource];
          const effective = limitByResource.get(resource);
          return (
            <div key={resource} className="space-y-1.5">
              <Label htmlFor={`override-${resource}`} className="flex items-center justify-between">
                <span>{RESOURCE_LABELS[resource]}</span>
                <span className="text-muted-foreground text-xs font-normal">
                  Now: {effective === null || effective === undefined ? "Unlimited" : effective}
                </span>
              </Label>
              <div className="flex gap-2">
                <Select
                  value={entry.mode}
                  disabled={disabled}
                  onValueChange={(mode) =>
                    setState((prev) => ({
                      ...prev,
                      [resource]: { ...prev[resource], mode: mode as OverrideMode },
                    }))
                  }
                >
                  <SelectTrigger id={`override-${resource}`} className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Plan default</SelectItem>
                    <SelectItem value="unlimited">Unlimited</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {entry.mode === "custom" ? (
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    className="w-24"
                    disabled={disabled}
                    value={entry.value}
                    onChange={(event) =>
                      setState((prev) => ({
                        ...prev,
                        [resource]: { ...prev[resource], value: event.target.value },
                      }))
                    }
                  />
                ) : null}
              </div>
              {resource === "products" ? (
                <p className="text-muted-foreground text-xs">
                  Import row cap with this setting:{" "}
                  {formatNumber(
                    derivedMaxImportRows(
                      entry.mode === "unlimited"
                        ? null
                        : entry.mode === "custom" &&
                            Number.isInteger(Number(entry.value.trim())) &&
                            Number(entry.value.trim()) > 0
                          ? Number(entry.value.trim())
                          : catalogProductLimit,
                    ),
                  )}{" "}
                  per file.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="border-border space-y-3 border-t pt-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">Cloud entitlements</p>
          <p className="text-muted-foreground text-xs">
            Restrict which cloud modes this organization may select, and toggle cloud backup and
            remote monitoring. Selecting all modes removes the restriction.
          </p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-normal">Allowed cloud modes</Label>
          <div className="flex flex-wrap gap-4">
            {CLOUD_MODE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 text-sm"
                htmlFor={`allow-mode-${option.value}`}
              >
                <Checkbox
                  id={`allow-mode-${option.value}`}
                  checked={modes.has(option.value)}
                  disabled={disabled}
                  onCheckedChange={(checked) => toggleMode(option.value, checked === true)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="entitlement-backup" className="text-sm font-normal">
            Cloud backup
          </Label>
          <Switch
            id="entitlement-backup"
            checked={backupOn}
            disabled={disabled}
            onCheckedChange={setBackupOn}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="entitlement-monitoring" className="text-sm font-normal">
            Remote monitoring
          </Label>
          <Switch
            id="entitlement-monitoring"
            checked={monitoringOn}
            disabled={disabled}
            onCheckedChange={setMonitoringOn}
          />
        </div>
      </div>

      <Button type="button" variant="outline" disabled={disabled} onClick={submit}>
        Save limits
      </Button>
    </div>
  );
}

function EnterpriseBackupQuota({
  currentBytes,
  disabled,
  onSave,
}: {
  currentBytes: number | null;
  disabled: boolean;
  onSave: (backupLimitGb: number | null) => void;
}) {
  const [value, setValue] = useState(currentBytes === null ? "" : String(currentBytes / GIBIBYTE));

  function submit() {
    const trimmed = value.trim();
    if (trimmed === "") {
      onSave(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed)) {
      toast.error("Enter a whole number of gigabytes, or leave blank for no cap.");
      return;
    }
    onSave(parsed);
  }

  return (
    <div className="border-border space-y-3 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Cloud backup quota</p>
        <p className="text-muted-foreground text-xs">
          Quoted per Enterprise customer. Leave blank for no cap. Whole gigabytes,{" "}
          {MAX_CUSTOM_BACKUP_GB} GB maximum.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="enterprise-backup-gb">Storage (GB)</Label>
          <Input
            id="enterprise-backup-gb"
            type="number"
            min={1}
            max={MAX_CUSTOM_BACKUP_GB}
            step={1}
            inputMode="numeric"
            placeholder="No cap"
            value={value}
            disabled={disabled}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        <Button type="button" variant="outline" disabled={disabled} onClick={submit}>
          Save quota
        </Button>
      </div>
    </div>
  );
}
