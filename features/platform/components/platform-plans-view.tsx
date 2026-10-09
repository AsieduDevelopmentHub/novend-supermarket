"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Layers, Plus, RefreshCw } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import {
  formatPlanPriceLabel,
  listPriceFromReal,
  MEBIBYTE,
  MIN_MONTHLY_PRICE_GHS,
} from "@/convex/shared/plans";
import { showError } from "@/lib/errors";

type PlanRow = {
  _id: Id<"plans">;
  key: string;
  name: string;
  description: string;
  tagline?: string;
  audience?: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  listMonthlyPrice: number | null;
  listYearlyPrice: number | null;
  productLimit: number | null;
  userLimit: number | null;
  branchLimit: number | null;
  deviceLimit: number | null;
  backupLimitBytes: number | null;
  features: string[];
  isLifetime: boolean;
  priceFrom?: boolean;
  variableBackup?: boolean;
  featured?: boolean;
  selfServe?: boolean;
  marketingVisible?: boolean;
  homepageHighlight?: boolean;
  legacy?: boolean;
  archived?: boolean;
  sortOrder: number;
};

export function PlatformPlansView() {
  const data = useQuery(api.platformPlans.listPlans);
  const ensureCatalog = useMutation(api.platformPlans.ensureCatalog);
  const updateSettings = useMutation(api.platformPlans.updateBillingSettings);
  const setMarketing = useMutation(api.platformPlans.setPlanMarketing);
  const archivePlan = useMutation(api.platformPlans.archivePlan);
  const createPlan = useMutation(api.platformPlans.createPlan);
  const updatePlan = useMutation(api.platformPlans.updatePlan);

  const [markupDraft, setMarkupDraft] = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState<PlanRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const markup = markupDraft ?? String(data?.listPriceMarkupPercent ?? 20);
  const previewReal = MIN_MONTHLY_PRICE_GHS;
  const previewList = listPriceFromReal(previewReal, Number(markup) || 0);

  const plans = useMemo(() => data?.plans ?? [], [data?.plans]);

  if (data === undefined) {
    return <LoadingState label="Loading plan catalog…" />;
  }

  async function onSaveMarkup() {
    setBusy(true);
    try {
      const result = await updateSettings({ listPriceMarkupPercent: Number(markup) });
      setMarkupDraft(null);
      toast.success(`List-price markup set to ${result.listPriceMarkupPercent}%`);
    } catch (error) {
      showError(error, "Could not save markup");
    } finally {
      setBusy(false);
    }
  }

  async function onEnsureSeed() {
    setBusy(true);
    try {
      await ensureCatalog({});
      toast.success("Seed catalog refreshed");
    } catch (error) {
      showError(error, "Could not refresh catalog");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans catalog"
        description="Public pricing, homepage highlights, and the psychological list-price markup. Charged amounts stay on the real monthly price."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void onEnsureSeed()}>
              <RefreshCw className="size-4" />
              Sync seed
            </Button>
            <Button type="button" disabled={busy} onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New plan
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">List-price markup (price drop)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="markup">Markup %</Label>
            <Input
              id="markup"
              type="number"
              min={0}
              max={90}
              value={markup}
              onChange={(e) => setMarkupDraft(e.target.value)}
              className="w-28"
            />
          </div>
          <p className="text-muted-foreground text-sm">
            Preview: {formatPlanPriceLabel(previewReal)} shows as was{" "}
            <span className="line-through">{formatPlanPriceLabel(previewList)}</span> (Save{" "}
            {Number(markup) || 0}%)
          </p>
          <Button type="button" disabled={busy || markupDraft === null} onClick={() => void onSaveMarkup()}>
            Save markup
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {plans.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Layers}
                title="No plans yet"
                description="Tap Sync seed to install the default ladder."
              />
            </div>
          ) : (
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Monthly</th>
                  <th className="px-4 py-3 font-medium">Products</th>
                  <th className="px-4 py-3 font-medium">Marketing</th>
                  <th className="px-4 py-3 font-medium">Flags</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan._id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="font-medium">{plan.name}</div>
                      <div className="text-muted-foreground text-xs">{plan.key}</div>
                    </td>
                    <td className="px-4 py-3">
                      {plan.monthlyPrice != null ? (
                        <div>
                          <div>{formatPlanPriceLabel(plan.monthlyPrice, plan.priceFrom)}</div>
                          {plan.listMonthlyPrice != null ? (
                            <div className="text-muted-foreground text-xs line-through">
                              {formatPlanPriceLabel(plan.listMonthlyPrice, plan.priceFrom)}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {plan.productLimit === null ? "∞" : plan.productLimit.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {plan.marketingVisible ? <Badge variant="secondary">Visible</Badge> : null}
                        {plan.homepageHighlight ? <Badge>Homepage</Badge> : null}
                        {plan.featured ? <Badge variant="outline">Recommended</Badge> : null}
                        {plan.archived ? <Badge variant="destructive">Archived</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {plan.selfServe ? "Self-serve" : "Manual"}
                      {plan.legacy ? " · Legacy" : ""}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy || Boolean(plan.isLifetime)}
                          onClick={() => setEditPlan(plan)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy || Boolean(plan.isLifetime)}
                          onClick={() => {
                            void (async () => {
                              setBusy(true);
                              try {
                                await setMarketing({
                                  planId: plan._id,
                                  marketingVisible: !plan.marketingVisible,
                                });
                                toast.success(
                                  plan.marketingVisible ? "Hidden from marketing" : "Shown on marketing",
                                );
                              } catch (error) {
                                showError(error);
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }}
                        >
                          {plan.marketingVisible ? "Hide" : "Show"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy || Boolean(plan.isLifetime)}
                          onClick={() => {
                            void (async () => {
                              setBusy(true);
                              try {
                                await setMarketing({
                                  planId: plan._id,
                                  homepageHighlight: !plan.homepageHighlight,
                                });
                                toast.success("Homepage highlight updated");
                              } catch (error) {
                                showError(error);
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }}
                        >
                          {plan.homepageHighlight ? "Unhighlight" : "Homepage"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy || Boolean(plan.isLifetime)}
                          onClick={() => {
                            void (async () => {
                              setBusy(true);
                              try {
                                await archivePlan({
                                  planId: plan._id,
                                  archived: !plan.archived,
                                });
                                toast.success(plan.archived ? "Plan restored" : "Plan archived");
                              } catch (error) {
                                showError(error);
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }}
                        >
                          {plan.archived ? "Restore" : "Archive"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <PlanFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create plan"
        submitLabel="Create"
        busy={busy}
        onSubmit={async (values) => {
          setBusy(true);
          try {
            await createPlan(values);
            toast.success("Plan created");
            setCreateOpen(false);
          } catch (error) {
            showError(error);
          } finally {
            setBusy(false);
          }
        }}
      />

      <PlanFormDialog
        open={Boolean(editPlan)}
        onOpenChange={(open) => {
          if (!open) setEditPlan(null);
        }}
        title={editPlan ? `Edit ${editPlan.name}` : "Edit plan"}
        submitLabel="Save"
        busy={busy}
        initial={editPlan ?? undefined}
        onSubmit={async (values) => {
          if (!editPlan) return;
          setBusy(true);
          try {
            await updatePlan({
              planId: editPlan._id as Id<"plans">,
              name: values.name,
              tagline: values.tagline,
              audience: values.audience,
              monthlyPrice: values.monthlyPrice,
              productLimit: values.productLimit,
              userLimit: values.userLimit,
              branchLimit: values.branchLimit,
              deviceLimit: values.deviceLimit,
              backupLimitBytes: values.backupLimitBytes,
              features: values.features,
              priceFrom: values.priceFrom,
              variableBackup: values.variableBackup,
              featured: values.featured,
              selfServe: values.selfServe,
              marketingVisible: values.marketingVisible,
              homepageHighlight: values.homepageHighlight,
              sortOrder: values.sortOrder,
            });
            toast.success("Plan updated");
            setEditPlan(null);
          } catch (error) {
            showError(error);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

type FormValues = {
  key: string;
  name: string;
  tagline: string;
  audience: string;
  monthlyPrice: number;
  productLimit: number | null;
  userLimit: number | null;
  branchLimit: number | null;
  deviceLimit: number | null;
  backupLimitBytes: number | null;
  features: string[];
  priceFrom: boolean;
  variableBackup: boolean;
  featured: boolean;
  selfServe: boolean;
  marketingVisible: boolean;
  homepageHighlight: boolean;
  sortOrder: number;
};

function PlanFormDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  busy,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  busy: boolean;
  initial?: PlanRow;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const isCreate = !initial;
  const [key, setKey] = useState(initial?.key ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [tagline, setTagline] = useState(initial?.tagline ?? initial?.description ?? "");
  const [audience, setAudience] = useState(initial?.audience ?? "");
  const [monthly, setMonthly] = useState(String(initial?.monthlyPrice ?? MIN_MONTHLY_PRICE_GHS));
  const [products, setProducts] = useState(
    initial?.productLimit === null ? "" : String(initial?.productLimit ?? 100),
  );
  const [users, setUsers] = useState(
    initial?.userLimit === null ? "" : String(initial?.userLimit ?? 1),
  );
  const [branches, setBranches] = useState(
    initial?.branchLimit === null ? "" : String(initial?.branchLimit ?? 1),
  );
  const [devices, setDevices] = useState(
    initial?.deviceLimit === null ? "" : String(initial?.deviceLimit ?? 1),
  );
  const [backupMb, setBackupMb] = useState(
    initial?.backupLimitBytes == null
      ? ""
      : String(Math.round(initial.backupLimitBytes / MEBIBYTE)),
  );
  const [featuresText, setFeaturesText] = useState((initial?.features ?? []).join("\n"));
  const [priceFrom, setPriceFrom] = useState(Boolean(initial?.priceFrom));
  const [variableBackup, setVariableBackup] = useState(Boolean(initial?.variableBackup));
  const [featured, setFeatured] = useState(Boolean(initial?.featured));
  const [selfServe, setSelfServe] = useState(initial?.selfServe !== false);
  const [marketingVisible, setMarketingVisible] = useState(initial?.marketingVisible !== false);
  const [homepageHighlight, setHomepageHighlight] = useState(Boolean(initial?.homepageHighlight));
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 10));

  useEffect(() => {
    if (!open) return;
    setKey(initial?.key ?? "");
    setName(initial?.name ?? "");
    setTagline(initial?.tagline ?? initial?.description ?? "");
    setAudience(initial?.audience ?? "");
    setMonthly(String(initial?.monthlyPrice ?? MIN_MONTHLY_PRICE_GHS));
    setProducts(initial?.productLimit === null ? "" : String(initial?.productLimit ?? 100));
    setUsers(initial?.userLimit === null ? "" : String(initial?.userLimit ?? 1));
    setBranches(initial?.branchLimit === null ? "" : String(initial?.branchLimit ?? 1));
    setDevices(initial?.deviceLimit === null ? "" : String(initial?.deviceLimit ?? 1));
    setBackupMb(
      initial?.backupLimitBytes == null
        ? ""
        : String(Math.round(initial.backupLimitBytes / MEBIBYTE)),
    );
    setFeaturesText((initial?.features ?? []).join("\n"));
    setPriceFrom(Boolean(initial?.priceFrom));
    setVariableBackup(Boolean(initial?.variableBackup));
    setFeatured(Boolean(initial?.featured));
    setSelfServe(initial?.selfServe !== false);
    setMarketingVisible(initial?.marketingVisible !== false);
    setHomepageHighlight(Boolean(initial?.homepageHighlight));
    setSortOrder(String(initial?.sortOrder ?? 10));
  }, [open, initial]);

  function parseNullableInt(raw: string): number | null {
    const t = raw.trim();
    if (!t) return null;
    return Number.parseInt(t, 10);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {isCreate ? (
            <div className="space-y-1.5">
              <Label htmlFor="plan-key">Key (slug)</Label>
              <Input id="plan-key" value={key} onChange={(e) => setKey(e.target.value)} />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="plan-name">Name</Label>
            <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-tagline">Tagline</Label>
            <Input id="plan-tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-audience">Audience</Label>
            <Input
              id="plan-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="plan-monthly">Monthly GH₵</Label>
              <Input
                id="plan-monthly"
                type="number"
                min={MIN_MONTHLY_PRICE_GHS}
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-sort">Sort order</Label>
              <Input
                id="plan-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Products (blank = ∞)</Label>
              <Input value={products} onChange={(e) => setProducts(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Users (blank = ∞)</Label>
              <Input value={users} onChange={(e) => setUsers(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Branches (blank = ∞)</Label>
              <Input value={branches} onChange={(e) => setBranches(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Devices (blank = ∞)</Label>
              <Input value={devices} onChange={(e) => setDevices(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Backup MB (blank = custom/∞)</Label>
            <Input value={backupMb} onChange={(e) => setBackupMb(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Features (one per line)</Label>
            <Textarea
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              rows={5}
            />
          </div>
          <div className="grid gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={priceFrom} onCheckedChange={(v) => setPriceFrom(v === true)} />
              Price from (Enterprise-style +)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={variableBackup}
                onCheckedChange={(v) => setVariableBackup(v === true)}
              />
              Variable backup quota
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={featured} onCheckedChange={(v) => setFeatured(v === true)} />
              Recommended badge
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={selfServe} onCheckedChange={(v) => setSelfServe(v === true)} />
              Self-serve checkout
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={marketingVisible}
                onCheckedChange={(v) => setMarketingVisible(v === true)}
              />
              Show on marketing
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={homepageHighlight}
                onCheckedChange={(v) => setHomepageHighlight(v === true)}
              />
              Homepage highlight (max 3)
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              const backupRaw = backupMb.trim();
              void onSubmit({
                key,
                name,
                tagline,
                audience,
                monthlyPrice: Number(monthly),
                productLimit: parseNullableInt(products),
                userLimit: parseNullableInt(users),
                branchLimit: parseNullableInt(branches),
                deviceLimit: parseNullableInt(devices),
                backupLimitBytes: backupRaw
                  ? Number.parseInt(backupRaw, 10) * MEBIBYTE
                  : null,
                features: featuresText
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean),
                priceFrom,
                variableBackup,
                featured,
                selfServe,
                marketingVisible,
                homepageHighlight,
                sortOrder: Number(sortOrder) || 10,
              });
            }}
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
