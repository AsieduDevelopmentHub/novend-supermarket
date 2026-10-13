"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { api } from "@/convex/_generated/api";
import {
  BUSINESS_CAPABILITY_REGISTRY,
  INDUSTRY_PACKS,
  INDUSTRY_PROFILE_LABELS,
  INDUSTRY_PROFILES,
  businessCapabilitiesAllowedOnPlan,
  type BusinessCapabilityKey,
  type IndustryProfile,
} from "@/convex/shared/businessCapabilities";
import {
  OPS_CAPABILITY_DISABLE_WARNING_KEYS,
  opsDisableWarningCopy,
} from "@/convex/shared/businessTerms";
import { useLicense } from "@/hooks/use-license";
import { useOfflineStatus } from "@/providers/offline-provider";
import { saveBusinessCapabilitiesCache } from "@/lib/offline/business-capabilities";
import { cacheResolvedBusinessTerms } from "@/lib/offline/business-terms";
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

const PROFILE_BLURBS: Record<IndustryProfile, string> = {
  retail: "Simple selling — Add Product stays lean.",
  wholesale:
    "Pack/carton pricing at checkout, customer price lists, and on-account credit (Pro+).",
  supermarket: "Packs, dated lots, and optional sell-by-weight for produce.",
  convenience: "Pack pricing and dated lots for high-turn convenience stock.",
  cold_store: "Weight selling, lots, and optional scale support.",
  electronics: "Serial / IMEI tracking for high-value items.",
  pharmacy: "Lots, expiry, and custom catalog fields (inventory-oriented).",
  fashion: "Size and color variants — each variant is its own SKU and stock.",
  cosmetics: "Shade/size variants, lots/expiry, and custom product fields.",
  hardware: "Pack pricing plus serial tracking for tools and equipment.",
  stationery: "Pack pricing and variants for reams, packs, and assortments.",
  restaurant: "Menu catalogue, floor tables, modifiers, and kitchen tickets.",
  bar: "Drink menu, floor/tables, modifiers, and bar ticket queue.",
  hotel: "Rooms board, reservations, folio checkout, and room-rate catalogue at POS.",
  custom: "Start empty and turn on only what you need.",
};

/** Capabilities that change Add Product / sales UX — shown first. */
const CATALOG_KEYS: BusinessCapabilityKey[] = [
  "multi_unit_pricing",
  "product_variants",
  "customer_pricing",
  "customer_credit",
  "sell_by_weight",
  "lot_expiry",
  "serial_tracking",
  "custom_fields",
  "non_stock_sales",
  "modifiers",
  "tables_orders",
  "kitchen_tickets",
  "rooms_folio",
  "reservations",
];

const OTHER_KEYS: BusinessCapabilityKey[] = (
  Object.keys(BUSINESS_CAPABILITY_REGISTRY) as BusinessCapabilityKey[]
).filter((key) => !CATALOG_KEYS.includes(key));

const OPS_DISABLE_SET = new Set<string>(OPS_CAPABILITY_DISABLE_WARNING_KEYS);

function productFormHint(key: BusinessCapabilityKey): string | null {
  switch (key) {
    case "multi_unit_pricing":
      return "Shows pack / carton units on Add Product and sell-unit picker at checkout";
    case "product_variants":
      return "Parent products with size/color/shade children (each child has its own stock)";
    case "customer_pricing":
      return "Customer groups and quantity price rules (Customers → Price lists)";
    case "customer_credit":
      return "On-account tender, credit limits, and customer ledger payments";
    case "sell_by_weight":
      return "Shows weight / fractional pricing on Add Product";
    case "lot_expiry":
      return "Shows expiry tracking on Add Product";
    case "serial_tracking":
      return "Track serials toggle on Add Product; serial capture at checkout";
    case "custom_fields":
      return "Free-form product attributes on Add Product";
    case "non_stock_sales":
      return "Shows Track inventory toggle on Add Product";
    case "modifiers":
      return "Modifier groups on menu products";
    case "tables_orders":
      return "Floor tables and open checks";
    case "kitchen_tickets":
      return "Kitchen / bar ticket queue";
    case "rooms_folio":
      return "Rooms board, stays, and folio checkout";
    case "reservations":
      return "Book arrivals and check in from a reservation";
    default:
      return null;
  }
}

function capabilityDiff(
  saved: readonly BusinessCapabilityKey[],
  draft: readonly BusinessCapabilityKey[],
): { added: BusinessCapabilityKey[]; removed: BusinessCapabilityKey[] } {
  const savedSet = new Set(saved);
  const draftSet = new Set(draft);
  return {
    added: draft.filter((key) => !savedSet.has(key)),
    removed: saved.filter((key) => !draftSet.has(key)),
  };
}

/**
 * Industry pack + capability flags.
 * Draft-only until Save — navigation keeps reading the last saved config.
 */
export function BusinessCapabilitiesPanel() {
  const { online } = useOfflineStatus();
  const { planKey, planName } = useLicense();
  const remote = useAuthedQuery(api.settings.getBusinessCapabilities, online ? {} : "skip");
  const update = useMutation(api.settings.updateBusinessCapabilities);

  const [profile, setProfile] = useState<IndustryProfile | null>(null);
  const [selected, setSelected] = useState<BusinessCapabilityKey[] | null>(null);
  const [saving, setSaving] = useState(false);

  const savedProfile = remote?.industryProfile ?? "retail";
  const savedSelected = remote?.enabledCapabilities ?? [];
  const effectiveProfile = profile ?? savedProfile;
  const effectiveSelected = selected ?? savedSelected;

  const allowedOnPlan = useMemo(
    () => new Set(businessCapabilitiesAllowedOnPlan(planKey)),
    [planKey],
  );

  const packPreview = INDUSTRY_PACKS[effectiveProfile].filter((key) => allowedOnPlan.has(key));
  const diff = capabilityDiff(savedSelected, effectiveSelected);
  const profileDirty = effectiveProfile !== savedProfile;
  const capsDirty = diff.added.length > 0 || diff.removed.length > 0;
  const dirty = profileDirty || capsDirty;

  const disablingOps = diff.removed.filter((key) => OPS_DISABLE_SET.has(key));
  const opsWarning = opsDisableWarningCopy(disablingOps);

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

  function fillDraftFromPack(nextProfile: IndustryProfile) {
    const pack = INDUSTRY_PACKS[nextProfile].filter((key) => allowedOnPlan.has(key));
    setProfile(nextProfile);
    setSelected(pack);
  }

  function onProfileChange(value: IndustryProfile) {
    // Selecting a profile loads pack defaults into local draft only — nav stays on saved config.
    fillDraftFromPack(value);
  }

  function onApplyPackToDraft() {
    fillDraftFromPack(effectiveProfile);
    toast.message(`Loaded ${INDUSTRY_PROFILE_LABELS[effectiveProfile]} pack into draft — Save to apply.`);
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
      await cacheResolvedBusinessTerms(next.industryProfile);
      toast.success("Selling options saved. Navigation updates to the new profile.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save capabilities");
    } finally {
      setSaving(false);
    }
  }

  function onDiscardDraft() {
    setProfile(null);
    setSelected(null);
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
    const willAdd = diff.added.includes(def.key);
    const willRemove = diff.removed.includes(def.key);
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
            {willAdd ? (
              <Badge variant="secondary" className="font-normal">
                Will enable
              </Badge>
            ) : null}
            {willRemove ? (
              <Badge variant="destructive" className="font-normal">
                Will disable
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
        <CardDescription>
          Changes stay in this form until you Save. Navigation and features keep using the last
          saved profile. Brand colours are never reset by a pack save.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <section className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="industry-profile">Industry profile</Label>
          </div>
          <Select
            value={effectiveProfile}
            onValueChange={(value) => onProfileChange(value as IndustryProfile)}
          >
            <SelectTrigger id="industry-profile" className="min-h-11 max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRY_PROFILES.map((key) => (
                <SelectItem key={key} value={key}>
                  {INDUSTRY_PROFILE_LABELS[key]}
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
            onClick={onApplyPackToDraft}
          >
            Fill draft from pack
          </Button>
        </section>

        {dirty ? (
          <section className="border-border bg-muted/40 space-y-2 rounded-[14px] border px-3 py-3">
            <p className="text-sm font-medium">Preview before Save</p>
            {profileDirty ? (
              <p className="text-muted-foreground text-xs">
                Profile: {INDUSTRY_PROFILE_LABELS[savedProfile]} → {INDUSTRY_PROFILE_LABELS[effectiveProfile]}
              </p>
            ) : null}
            {diff.added.length > 0 ? (
              <p className="text-muted-foreground text-xs">
                Will enable:{" "}
                {diff.added.map((key) => BUSINESS_CAPABILITY_REGISTRY[key].label).join(" · ")}
              </p>
            ) : null}
            {diff.removed.length > 0 ? (
              <p className="text-muted-foreground text-xs">
                Will disable:{" "}
                {diff.removed.map((key) => BUSINESS_CAPABILITY_REGISTRY[key].label).join(" · ")}
              </p>
            ) : null}
            {!profileDirty && !capsDirty ? null : null}
            {opsWarning ? (
              <p className="text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
                {opsWarning}
              </p>
            ) : null}
          </section>
        ) : null}

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
          <Button type="button" disabled={saving || !dirty} onClick={() => void onSave()}>
            {saving ? "Saving…" : "Save selling options"}
          </Button>
          {dirty ? (
            <Button type="button" variant="ghost" disabled={saving} onClick={onDiscardDraft}>
              Discard draft
            </Button>
          ) : null}
          <p className="text-muted-foreground text-xs">
            Retail default keeps Add Product free of packs, weight, and expiry fields.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
