"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import type { ResolvedSellUnit } from "@/convex/shared/units";

export type SellUnitPickerProduct = {
  id: string;
  name: string;
  stockQuantity: number;
  tracksInventory?: boolean;
};

type SellUnitPickerDialogProps = {
  open: boolean;
  product: SellUnitPickerProduct | null;
  units: ResolvedSellUnit[];
  onCancel: () => void;
  onSelect: (unitKey: string) => void;
};

/** Choose pack / carton / piece when a product has multiple active sell units. */
export function SellUnitPickerDialog({
  open,
  product,
  units,
  onCancel,
  onSelect,
}: SellUnitPickerDialogProps) {
  if (!product) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Choose unit — {product.name}</DialogTitle>
        </DialogHeader>
        <ul className="space-y-2">
          {units.map((unit) => {
            const maxDisplay =
              product.tracksInventory === false
                ? null
                : Math.floor(product.stockQuantity / unit.factorToBase);
            return (
              <li key={unit.key}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-between gap-3 px-3 py-3 text-left"
                  onClick={() => onSelect(unit.key)}
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{unit.label}</span>
                    <span className="text-muted-foreground block text-xs">
                      {unit.factorToBase === 1
                        ? "Base unit"
                        : `${unit.factorToBase} base per ${unit.label}`}
                      {maxDisplay !== null ? ` · up to ${maxDisplay}` : null}
                    </span>
                  </span>
                  <span className="text-primary shrink-0 text-sm font-semibold tabular-nums">
                    {formatCurrency(unit.unitPrice)}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
