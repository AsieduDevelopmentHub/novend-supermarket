"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  BUSINESS_CAPABILITY_REGISTRY,
  INDUSTRY_PACKS,
  INDUSTRY_PROFILES,
  businessCapabilitiesAllowedOnPlan,
  type BusinessCapabilityKey,
  type IndustryProfile,
} from "@/convex/shared/businessCapabilities";
import { useLicense } from "@/hooks/use-license";
import { useOfflineStatus } from "@/providers/offline-provider";
import { saveBusinessCapabilitiesCache } from "@/lib/offline/business-capabilities";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const PROFILE_LABELS: Record<IndustryProfile, string> = {
  retail: "Retail",
  wholesale: "Wholesale distribution",
  supermarket: "Supermarket",
  cold_store: "Cold store / meat & fish",
  electronics: "Electronics",
  pharmacy: "Pharmacy (inventory)",
  custom: "Custom",
};

const PROFILE_BLURBS: Record<IndustryProfile, string> = {
  retail: "Simple selling — Add Product stays lean.",
  wholesale: "Pack and carton pricing on products and at checkout.",
  supermarket: "Packs plus dated lots for perishable goods.",
  cold_store: "Weight selling, lots, and optional scale support.",
  electronics: "Serial / IMEI tracking for high-value items.",
  pharmacy: "Lots, expiry, and room for custom catalog fields.",
  custom: "Start empty and turn on only what you need.",
};

/** Capabilities that change Add Product / sales UX — shown first. */
const CATALOG_KEYS: BusinessCapabilityKey[] = [
  "multi_unit_pricing",
  "sell_by_weight",
  "lot_expiry",
  "serial_tracking",
];

const OTHER_KEYS: BusinessCapabilityKey[] = (
  Object.keys(BUSINESS_CAPABILITY_REGISTRY) as BusinessCapabilityKey[]
).filter((key) => !CATALOG_KEYS.includes(key));

function productFormHint(key: BusinessCapabilityKey): string | null {
  switch (key) {
    case "multi_unit_pricing":
      return "Shows pack / carton units on Add Product";
    case "sell_by_weight":
      return "Shows weight / fractional pricing on Add Product";
    case "lot_expiry":
      return "Shows expiry tracking on Add Product";
    case "serial_tracking":
      return "Serial fields land in a later release";
    default:
      return null;
  }
}

/**
 * Industry pack + capability flags. Catalog flags control what appears on Add Product.
 */
export function BusinessCapabilitiesPanel() {
  const { online } = useOfflineStatus();
  const { planKey, planName } = useLicense();
  const remote = useQuery(api.settings.getBusinessCapabilities, online ? {} : "skip");
  const update = useMutation(api.settings.updateBusinessCapabilities);

  const [profile, setProfile] = useState<IndustryProfile | null>(null);
  const [selected, setSelected] = useState<BusinessCapabilityKey[] | null>(null);
  const [saving, setSaving] = useState(false);

  const effectiveProfile = profile ?? remote?.industryProfile ?? "retail";
  const effectiveSelected = selected ?? remote?.enabledCapabilities ?? [];

  const allowedOnPlan = useMemo(
    () => new Set(businessCapabilitiesAllowedOnPlan(planKey)),
    [planKey],
  );

  const packPreview = INDUSTRY_PACKS[effectiveProfile];

  if (!online) {
    return (
      <Card className="rounded-[20px]">
        <CardHeader>
          <CardTitle className="text-base">Selling & catalog options</CardTitle>
          <CardDescription>
            Connect to the internet to change industry pack and capabilities. Cached flags still
            apply offline.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (remote === undefined) {
    return (
      <Card className="rounded-[20px]">
        <CardHeader>
          <CardTitle className="text-base">Selling & catalog options</CardTitle>
          <CardDescription>Loading configuration…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function onApplyPack() {
    setSaving(true);
    try {
      const next = await update({
        industryProfile: effectiveProfile,
        enabledCapabilities: INDUSTRY_PACKS[effectiveProfile],
        applyIndustryPack: true,
      });
      setProfile(next.industryProfile);
      setSelected(next.enabledCapabilities);
      await saveBusinessCapabilitiesCache(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not apply industry pack");
    } finally {
      setSaving(false);
    }
  }

  async function onSave() {
    setSaving(true);
    try {
      const next = await update({
        industryProfile: effectiveProfile,
        enabledCapabilities: effectiveSelected,
        applyIndustryPack: false,
      });
      setProfile(next.industryProfile);
      setSelected(next.enabledCapabilities);
      await saveBusinessCapabilitiesCache(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save capabilities");
    } finally {
      setSaving(false);
    }
  }

  function toggleKey(key: BusinessCapabilityKey, checked: boolean) {
    setSelected((prev) => {
      const base = prev ?? remote?.enabledCapabilities ?? [];
      if (checked) return base.includes(key) ? base : [...base, key];
      return base.filter((k) => k !== key);
    });
  }

  function renderCapability(key: BusinessCapabilityKey) {
    const def = BUSINESS_CAPABILITY_REGISTRY[key];
    const planOk = allowedOnPlan.has(def.key);
    const checked = effectiveSelected.includes(def.key);
    const hint = productFormHint(def.key);
    return (
      <label
        key={def.key}
        className="border-border hover:bg-muted/30 flex cursor-pointer items-start gap-3 rounded-[14px] border px-3 py-3 transition-colors"
      >
        <Checkbox
          checked={checked}
          disabled={!planOk || saving}
          onCheckedChange={(value) => toggleKey(def.key, value === true)}
          className="mt-0.5"
        />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{def.label}</span>
            {hint ? (
              <Badge variant="outline" className="font-normal">
                Add Product
              </Badge>
            ) : null}
          </span>
          <span className="text-muted-foreground block text-xs leading-relaxed">
            {def.description}
          </span>
          {hint ? <span className="text-muted-foreground block text-xs">{hint}</span> : null}
          {!planOk ? (
            <span className="text-destructive block text-xs">
              Not available on {planName}. Upgrade to enable.
            </span>
          ) : null}
        </span>
      </label>
    );
  }

  return (
    <Card className="rounded-[20px]">
      <CardHeader className="space-y-1.5">
        <CardTitle className="text-base">Selling & catalog options</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <section className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="industry-profile">Industry profile</Label>
          </div>
          <Select
            value={effectiveProfile}
            onValueChange={(value) => setProfile(value as IndustryProfile)}
          >
            <SelectTrigger id="industry-profile" className="min-h-11 max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRY_PROFILES.map((key) => (
                <SelectItem key={key} value={key}>
                  {PROFILE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-sm">{PROFILE_BLURBS[effectiveProfile]}</p>
          {packPreview.length > 0 ? (
            <p className="text-muted-foreground text-xs">
              Pack includes:{" "}
              {packPreview.map((key) => BUSINESS_CAPABILITY_REGISTRY[key].label).join(" · ")}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">Pack includes no extra catalog options.</p>
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => void onApplyPack()}
          >
            Apply pack defaults
          </Button>
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">Catalog & selling</h3>
            <p className="text-muted-foreground text-xs">
              These control fields on Add Product and how checkout counts stock.
            </p>
          </div>
          <div className="space-y-2">{CATALOG_KEYS.map(renderCapability)}</div>
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">Workspace</h3>
            <p className="text-muted-foreground text-xs">
              Broader product options that do not clutter the basic Add Product form.
            </p>
          </div>
          <div className="space-y-2">{OTHER_KEYS.map(renderCapability)}</div>
        </section>

        <div className="border-border flex flex-wrap items-center gap-3 border-t pt-4">
          <Button type="button" disabled={saving} onClick={() => void onSave()}>
            {saving ? "Saving…" : "Save selling options"}
          </Button>
          <p className="text-muted-foreground text-xs">
            Retail default keeps Add Product free of packs, weight, and expiry fields.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
