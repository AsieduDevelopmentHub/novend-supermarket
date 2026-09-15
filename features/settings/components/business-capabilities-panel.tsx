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

/**
 * Stage 1: industry pack + capability flags. Sell-mode behavior ships in later stages.
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

  if (!online) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Business type</CardTitle>
          <CardDescription>
            Connect to the internet to change industry pack and capabilities. Cached flags still
            apply offline for navigation gates.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (remote === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Business type</CardTitle>
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
      toast.success("Industry pack applied");
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
      toast.success("Business capabilities saved");
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business type & capabilities</CardTitle>
        <CardDescription>
          Choose an industry pack, then refine capabilities. Flags are off by default so existing
          shops keep today’s Novend. Plan: {planName}. Sell-by-weight and pack pricing activate in
          later releases once enabled here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="industry-profile">Industry profile</Label>
          <select
            id="industry-profile"
            className="border-input bg-background h-10 w-full max-w-md rounded-md border px-3 text-sm"
            value={effectiveProfile}
            onChange={(event) => setProfile(event.target.value as IndustryProfile)}
          >
            {INDUSTRY_PROFILES.map((key) => (
              <option key={key} value={key}>
                {PROFILE_LABELS[key]}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => void onApplyPack()}
          >
            Apply pack defaults
          </Button>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Enabled capabilities</legend>
          {Object.values(BUSINESS_CAPABILITY_REGISTRY).map((def) => {
            const planOk = allowedOnPlan.has(def.key);
            const checked = effectiveSelected.includes(def.key);
            return (
              <label
                key={def.key}
                className="border-border flex cursor-pointer items-start gap-3 rounded-lg border p-3"
              >
                <Checkbox
                  checked={checked}
                  disabled={!planOk || saving}
                  onCheckedChange={(value) => toggleKey(def.key, value === true)}
                  className="mt-0.5"
                />
                <span className="min-w-0 space-y-0.5">
                  <span className="block text-sm font-medium">{def.label}</span>
                  <span className="text-muted-foreground block text-xs">{def.description}</span>
                  {!planOk ? (
                    <span className="text-destructive block text-xs">
                      Not available on {planName}. Upgrade to enable.
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </fieldset>

        <Button type="button" disabled={saving} onClick={() => void onSave()}>
          {saving ? "Saving…" : "Save capabilities"}
        </Button>
      </CardContent>
    </Card>
  );
}
