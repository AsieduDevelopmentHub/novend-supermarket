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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { LoadingState } from "@/components/feedback/loading-state";
import {
  GIBIBYTE,
  MAX_CUSTOM_BACKUP_GB,
  PLAN_LIST,
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
  { value: "yearly", label: "Yearly" },
  { value: "lifetime", label: "Lifetime" },
];

/** Super-admin licence controls for a single organization. */
export function PlatformLicensePanel({
  organizationId,
  organizationName,
  status,
  limitOverrides,
  importExport,
}: {
  organizationId: Id<"organizations">;
  organizationName: string;
  status: OrganizationStatus | "inactive";
  limitOverrides: LimitOverrides;
  importExport?: OrgImportExportSnapshot | null;
}) {
  const online = useConnectivity();
  const license = useQuery(api.billing.organizationLicense, online ? { organizationId } : "skip");
  const assignPlan = useMutation(api.billing.assignPlan);
  const startTrial = useMutation(api.billing.startTrial);
  const resetActivation = useMutation(api.billing.resetActivation);
  const setBackupLimit = useMutation(api.billing.setBackupLimit);
  const setStatus = useMutation(api.platform.setOrganizationStatus);
  const setLimitOverrides = useMutation(api.platform.setOrganizationLimitOverrides);
  const extendSubscription = useMutation(api.platform.extendSubscription);
  const archiveOrganization = useMutation(api.platform.archiveOrganization);

  const [planKey, setPlanKey] = useState<PlanKey>("pro");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [note, setNote] = useState("");
  const [extendDays, setExtendDays] = useState("30");
  const [pending, setPending] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmArchiveName, setConfirmArchiveName] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);

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
  const cycleAllowed = selectedPlan ? supportsCycle(selectedPlan, cycle) : false;

  async function run(label: string, work: () => Promise<unknown>) {
    if (!online) {
      toast.error("Licence and status changes require a connection");
      return;
    }
    setPending(true);
    try {
      await work();
      toast.success(label);
    } catch (error) {
      showError(error, "Action failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
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
            key={`${organizationId}-${JSON.stringify(limitOverrides)}`}
            overrides={limitOverrides}
            effectiveLimits={license.usage}
            catalogProductLimit={
              PLAN_LIST.find((plan) => plan.key === license.planKey)?.limits.products ?? null
            }
            disabled={pending || !online}
            onSave={(payload) =>
              void run("Resource limits updated", () =>
                setLimitOverrides({ organizationId, ...payload }),
              )
            }
          />

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

          <div className="border-border space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Assign a plan</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="license-plan">Plan</Label>
                <Select value={planKey} onValueChange={(value) => setPlanKey(value as PlanKey)}>
                  <SelectTrigger id="license-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_LIST.map((plan) => (
                      <SelectItem key={plan.key} value={plan.key}>
                        {plan.name}
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
                    {CYCLES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                onClick={() =>
                  void run("Plan assigned", () =>
                    assignPlan({ organizationId, planKey, cycle, note: note.trim() || undefined }),
                  )
                }
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
  disabled,
  onSave,
}: {
  overrides: LimitOverrides;
  effectiveLimits: Array<{ resource: LimitResource; limit: number | null }>;
  catalogProductLimit: number | null;
  disabled: boolean;
  onSave: (payload: {
    products?: number | null;
    users?: number | null;
    branches?: number | null;
    devices?: number | null;
    clear?: OverrideResource[];
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

  const limitByResource = new Map(effectiveLimits.map((row) => [row.resource, row.limit]));

  function submit() {
    const payload: {
      products?: number | null;
      users?: number | null;
      branches?: number | null;
      devices?: number | null;
      clear: OverrideResource[];
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
