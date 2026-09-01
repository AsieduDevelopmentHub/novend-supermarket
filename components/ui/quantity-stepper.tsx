"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnsignedQuantityInput } from "@/components/ui/unsigned-quantity-input";
import { clampInt, parseUnsignedInt } from "@/lib/quantity";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (next: number) => void;
  "aria-label": string;
  className?: string;
};

export function QuantityStepper({
  value,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  disabled,
  onChange,
  "aria-label": ariaLabel,
  className,
}: Props) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  function commit(raw: string) {
    const parsed = parseUnsignedInt(raw);
    if (parsed === null) {
      setDraft(String(value));
      return;
    }
    const next = clampInt(parsed, min, max);
    onChange(next);
    setDraft(String(next));
  }

  function step(delta: number) {
    onChange(clampInt(value + delta, min, max));
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-9 shrink-0"
        aria-label={`Decrease ${ariaLabel}`}
        disabled={disabled || value <= min}
        onClick={() => step(-1)}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <UnsignedQuantityInput
        aria-label={ariaLabel}
        disabled={disabled}
        className="h-9 w-[4.5rem] px-1 text-center text-sm font-semibold"
        value={focused ? draft : String(value)}
        onValueChange={setDraft}
        onFocus={() => {
          setDraft(String(value));
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
          commit(draft);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-9 shrink-0"
        aria-label={`Increase ${ariaLabel}`}
        disabled={disabled || value >= max}
        onClick={() => step(1)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
