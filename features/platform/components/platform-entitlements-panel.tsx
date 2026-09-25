"use client";

import { useMemo, useState } from "react";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LoadingState } from "@/components/feedback/loading-state";
import { useConnectivity } from "@/hooks/use-connectivity";
import { showError } from "@/lib/errors";
import type { FeatureKey } from "@/convex/shared/features";
import type { BillingVisibility } from "@/convex/shared/organizationConfig";

type OverrideValue = "inherit" | "enabled" | "disabled";

const CATEGORY_LABELS: Record<string, string> = {
  billing: "Billing",
  commerce: "Commerce",
  inventory: "Inventory",
  branches: "Branches",
  reports: "Reports",
  staff: "Staff",
  hardware: "Hardware",
  cloud: "Cloud",
  imports: "Imports",
  exports: "Exports",
};

const BILLING_VISIBILITY_OPTIONS: { value: BillingVisibility; label: string; hint: string }[] = [
  { value: "visible", label: "Visible", hint: "Show Billing and public plans" },
  { value: "hidden", label: "Hidden", hint: "Hide Billing UI; platform manages commercially" },
  {
    value: "custom_offer_only",
    label: "Custom offer only",
    hint: "Show Billing with only the assigned private offer",
  },
];

/** Platform Entitlements tab — template, overrides, billing visibility. */
export function PlatformEntitlementsPanel({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const online = useConnectivity();
  const config = useQuery(
    api.platform.getOrganizationConfig,
    online ? { organizationId } : "skip",
  );
  const templates = useQuery(api.featureTemplates.list, online ? { status: "active" } : "skip");
  const assignTemplate = useMutation(api.featureTemplates.assignToOrganization);
  const setOverrides = useMutation(api.featureTemplates.setOrganizationFeatureOverrides);
  const setBillingVisibility = useMutation(api.featureTemplates.setOrganizationBillingVisibility);

  const [templateId, setTemplateId] = useState<string>("none");
  const [overrides, setOverrideMap] = useState<Record<string, OverrideValue>>({});
  const [billingVisibility, setBillingVisibilityLocal] = useState<BillingVisibility>("visible");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [draftSourceKey, setDraftSourceKey] = useState<string | null>(null);

  // Sync draft from server when assignment versions change (avoid effect setState).
  const nextSourceKey = config
    ? `${config.assignment.featureEntitlementVersion}:${config.assignment.featureTemplateId ?? "none"}:${config.assignment.billingVisibility}`
    : null;
  if (config && nextSourceKey !== draftSourceKey) {
    setDraftSourceKey(nextSourceKey);
    setTemplateId(config.assignment.featureTemplateId ?? "none");
    setBillingVisibilityLocal(config.assignment.billingVisibility);
    const map: Record<string, OverrideValue> = {};
    for (const row of config.featureRows) {
      map[row.feature] = row.override;
    }
    setOverrideMap(map);
  }

  const grouped = useMemo(() => {
    if (!config) return [];
    const q = search.trim().toLowerCase();
    const rows = config.featureRows.filter((row) => {
      if (!q) return true;
      return (
        row.label.toLowerCase().includes(q) ||
        row.feature.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q)
      );
    });
    const byCategory = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byCategory.get(row.category) ?? [];
      list.push(row);
      byCategory.set(row.category, list);
    }
    return [...byCategory.entries()].map(([category, features]) => ({
      category,
      label: CATEGORY_LABELS[category] ?? category,
      features,
    }));
  }, [config, search]);

  if (!online && config === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Entitlements</CardTitle>
          <CardDescription>Entitlement controls need a connection.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (config === undefined || templates === undefined) {
    return <LoadingState label="Loading entitlements…" variant="form" />;
  }
  if (config === null) {
    return <LoadingState label="Organization not found…" variant="form" />;
  }

  const assignment = config.assignment;

  async function onSave() {
    if (!online) {
      toast.error("Entitlement changes require a connection");
      return;
    }
    setPending(true);
    try {
      const nextTemplate =
        templateId === "none" ? null : (templateId as Id<"featureTemplates">);
      if (nextTemplate !== (assignment.featureTemplateId ?? null)) {
        await assignTemplate({
          organizationId,
          featureTemplateId: nextTemplate,
        });
      }

      const featureOverrides = Object.entries(overrides).map(([feature, value]) => ({
        feature: feature as FeatureKey,
        value,
      }));
      await setOverrides({ organizationId, featureOverrides });

      if (billingVisibility !== assignment.billingVisibility) {
        await setBillingVisibility({ organizationId, billingVisibility });
      }

      toast.success("Entitlements saved");
    } catch (error) {
      showError(error, "Save failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Entitlements
            <Badge variant="outline">v{config.assignment.featureEntitlementVersion}</Badge>
          </CardTitle>
          <CardDescription>
            Template and per-feature overrides. Hidden Billing does not disable payment enforcement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="feature-template">Feature template</Label>
              <Select
                value={templateId}
                onValueChange={setTemplateId}
                disabled={!online || pending}
              >
                <SelectTrigger id="feature-template">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (plan defaults)</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template._id} value={template._id}>
                      {template.name} ({template.key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing-visibility">Billing visibility</Label>
              <Select
                value={billingVisibility}
                onValueChange={(value) => setBillingVisibilityLocal(value as BillingVisibility)}
                disabled={!online || pending}
              >
                <SelectTrigger id="billing-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_VISIBILITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {
                  BILLING_VISIBILITY_OPTIONS.find((option) => option.value === billingVisibility)
                    ?.hint
                }
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feature-search">Search features</Label>
            <Input
              id="feature-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Billing, reports, wholesale…"
            />
          </div>

          {grouped.length === 0 ? (
            <p className="text-muted-foreground text-sm">No features match this search.</p>
          ) : (
            <Accordion type="multiple" defaultValue={[]}>
              {grouped.map((group) => (
                <AccordionItem key={group.category} value={group.category}>
                  <AccordionTrigger>{group.label}</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      {group.features.map((row) => (
                        <div
                          key={row.feature}
                          className="border-border flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{row.label}</p>
                              <Badge variant={row.effective ? "success" : "secondary"}>
                                {row.effective ? "On" : "Off"}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground text-xs">{row.description}</p>
                            <p className="text-muted-foreground font-mono text-xs">{row.feature}</p>
                            <p className="text-xs">{row.sourceLabel}</p>
                            {row.prerequisites.length > 0 ? (
                              <p className="text-muted-foreground text-xs">
                                Requires: {row.prerequisites.join(", ")}
                              </p>
                            ) : null}
                          </div>
                          <Select
                            value={overrides[row.feature] ?? "inherit"}
                            onValueChange={(value) =>
                              setOverrideMap((prev) => ({
                                ...prev,
                                [row.feature]: value as OverrideValue,
                              }))
                            }
                            disabled={!online || pending}
                          >
                            <SelectTrigger className="w-[140px]" aria-label={`${row.label} override`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inherit">Inherit</SelectItem>
                              <SelectItem value="enabled">Enabled</SelectItem>
                              <SelectItem value="disabled">Disabled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}

          <Button type="button" disabled={!online || pending} onClick={() => void onSave()}>
            Save entitlements
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
