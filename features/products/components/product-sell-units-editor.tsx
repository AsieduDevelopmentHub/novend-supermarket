"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { ProductSellUnit } from "@/convex/shared/units";

export type SellUnitDraft = {
  key: string;
  label: string;
  factorToBase: string;
  sellingPrice: string;
  barcode: string;
  active: boolean;
};

export function emptySellUnitDraft(): SellUnitDraft {
  return {
    key: `unit_${Math.random().toString(36).slice(2, 8)}`,
    label: "",
    factorToBase: "1",
    sellingPrice: "",
    barcode: "",
    active: true,
  };
}

export function draftsFromSellUnits(
  units: ProductSellUnit[] | null | undefined,
  fallbackUnit: string,
  fallbackPrice: number,
): SellUnitDraft[] {
  if (units && units.length > 0) {
    return units.map((u) => ({
      key: u.key,
      label: u.label,
      factorToBase: String(u.factorToBase),
      sellingPrice: u.sellingPrice != null ? String(u.sellingPrice) : "",
      barcode: u.barcode ?? "",
      active: u.active,
    }));
  }
  return [
    {
      key: "default",
      label: fallbackUnit || "unit",
      factorToBase: "1",
      sellingPrice: String(fallbackPrice || 0),
      barcode: "",
      active: true,
    },
  ];
}

export function parseSellUnitDrafts(drafts: SellUnitDraft[]): ProductSellUnit[] {
  const parsed: ProductSellUnit[] = [];
  for (const draft of drafts) {
    const label = draft.label.trim();
    const factor = Number(draft.factorToBase);
    if (!label || !Number.isFinite(factor) || factor <= 0) {
      throw new Error("Each sell unit needs a label and a positive factor to base stock");
    }
    const priceRaw = draft.sellingPrice.trim();
    const sellingPrice = priceRaw === "" ? undefined : Number(priceRaw);
    if (sellingPrice != null && (!Number.isFinite(sellingPrice) || sellingPrice < 0)) {
      throw new Error(`Invalid price for sell unit “${label}”`);
    }
    parsed.push({
      key: draft.key.trim() || emptySellUnitDraft().key,
      label,
      factorToBase: factor,
      barcode: draft.barcode.trim() || undefined,
      sellingPrice,
      active: draft.active,
    });
  }
  if (parsed.filter((u) => u.active).length === 0) {
    throw new Error("Keep at least one active sell unit");
  }
  return parsed;
}

type Props = {
  drafts: SellUnitDraft[];
  onChange: (next: SellUnitDraft[]) => void;
  baseUnitLabel: string;
  showPacks: boolean;
  showWeight: boolean;
};

/**
 * Edit sell units when multi-unit and/or weight capabilities are enabled.
 * Stock remains in the product base unit (`unit` field).
 */
export function ProductSellUnitsEditor({
  drafts,
  onChange,
  baseUnitLabel,
  showPacks,
  showWeight,
}: Props) {
  if (!showPacks && !showWeight) return null;

  function patch(index: number, patchRow: Partial<SellUnitDraft>) {
    onChange(drafts.map((row, i) => (i === index ? { ...row, ...patchRow } : row)));
  }

  return (
    <div className="border-border space-y-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">Sell units</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Base stock unit is <span className="font-medium">{baseUnitLabel || "unit"}</span>. Pack
          factors convert to that base
          {showWeight ? "; weight mode allows fractional quantities at checkout" : ""}.
        </p>
      </div>
      <div className="space-y-3">
        {drafts.map((row, index) => (
          <div
            key={row.key}
            className="border-border grid gap-2 rounded-md border p-2 sm:grid-cols-2 lg:grid-cols-5"
          >
            <div className="space-y-1 lg:col-span-1">
              <Label className="text-xs">Label</Label>
              <Input
                value={row.label}
                placeholder={showWeight ? "kg" : "Pack of 6"}
                onChange={(e) => patch(index, { label: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Factor → base</Label>
              <Input
                type="number"
                min="0.000001"
                step="any"
                value={row.factorToBase}
                onChange={(e) => patch(index, { factorToBase: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Price / sell unit</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={row.sellingPrice}
                placeholder="Uses base × factor"
                onChange={(e) => patch(index, { sellingPrice: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Barcode</Label>
              <Input
                value={row.barcode}
                placeholder="Optional"
                onChange={(e) => patch(index, { barcode: e.target.value })}
              />
            </div>
            <div className="flex items-end justify-between gap-2 pb-1">
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={row.active}
                  onCheckedChange={(v) => patch(index, { active: v === true })}
                />
                Active
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={drafts.length <= 1}
                onClick={() => onChange(drafts.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
      {showPacks ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...drafts, emptySellUnitDraft()])}
        >
          Add sell unit
        </Button>
      ) : null}
    </div>
  );
}
