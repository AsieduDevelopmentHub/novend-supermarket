"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isStockUnitPreset, STOCK_UNIT_PRESETS } from "@/convex/shared/units";

const CUSTOM_VALUE = "__custom__";

type Props = {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
  dense?: boolean;
};

/**
 * Preset unit select with optional custom value.
 * Keeps free-text for shops that need a label outside the list.
 */
export function UnitPresetField({ id, label, value, onChange, required, hint, dense }: Props) {
  const trimmed = value.trim();
  const preset = isStockUnitPreset(trimmed) ? trimmed : null;
  const [customMode, setCustomMode] = useState(() => Boolean(trimmed) && !preset);

  const selectValue = customMode || !preset ? CUSTOM_VALUE : preset;

  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className={dense ? "text-xs" : undefined}>
        {label}
      </Label>
      <Select
        value={selectValue}
        onValueChange={(next) => {
          if (next === CUSTOM_VALUE) {
            setCustomMode(true);
            if (preset) onChange("");
            return;
          }
          setCustomMode(false);
          onChange(next);
        }}
      >
        <SelectTrigger id={id} className="min-h-11">
          <SelectValue placeholder="Select unit" />
        </SelectTrigger>
        <SelectContent>
          {STOCK_UNIT_PRESETS.map((row) => (
            <SelectItem key={row.value} value={row.value}>
              {row.label}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_VALUE}>Other…</SelectItem>
        </SelectContent>
      </Select>
      {selectValue === CUSTOM_VALUE ? (
        <Input
          className="min-h-11"
          value={customMode || !preset ? value : ""}
          onChange={(e) => {
            setCustomMode(true);
            onChange(e.target.value);
          }}
          placeholder="e.g. sachet, roll, bundle"
          required={required}
          autoComplete="off"
        />
      ) : null}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}
