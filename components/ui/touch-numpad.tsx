"use client";

import { useState } from "react";
import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (next: string) => void;
  /** Allow a decimal point (money / weight). Default true. */
  allowDecimal?: boolean;
  /** Max fractional digits when decimal allowed. */
  maxFractionDigits?: number;
  disabled?: boolean;
  className?: string;
  /** Accessible label for the keypad trigger. */
  label?: string;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"] as const;
type NumpadKey = (typeof KEYS)[number];

/**
 * Compact keypad icon for touch tills. Opens a popover numpad beside money/qty fields.
 */
export function TouchNumpadButton({
  value,
  onChange,
  allowDecimal = true,
  maxFractionDigits = 2,
  disabled,
  className,
  label = "Open keypad",
}: Props) {
  const [open, setOpen] = useState(false);

  function press(key: NumpadKey) {
    if (key === "⌫") {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === ".") {
      if (!allowDecimal || value.includes(".")) return;
      onChange(value === "" ? "0." : `${value}.`);
      return;
    }
    if (value === "0") {
      onChange(key);
      return;
    }
    if (allowDecimal && value.includes(".")) {
      const frac = value.split(".")[1] ?? "";
      if (frac.length >= maxFractionDigits) return;
    }
    onChange(`${value}${key}`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn("h-11 w-11 shrink-0", className)}
          disabled={disabled}
          aria-label={label}
        >
          <Keyboard className="h-4 w-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-2" align="end">
        <div className="mb-2 flex gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-10 flex-1"
            onClick={() => onChange("")}
          >
            Clear
          </Button>
          <Button type="button" className="h-10 flex-1" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {KEYS.map((key) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              className="h-12 text-base tabular-nums"
              disabled={key === "." && !allowDecimal}
              onClick={() => press(key)}
            >
              {key}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type FieldProps = {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  allowDecimal?: boolean;
  maxFractionDigits?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
};

/** Text input + touch keypad icon for POS money/quantity fields. */
export function NumericInputWithKeypad({
  id,
  value,
  onChange,
  allowDecimal = true,
  maxFractionDigits = 2,
  disabled,
  placeholder,
  className,
  inputMode = "decimal",
}: FieldProps) {
  return (
    <div className="flex gap-2">
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        enterKeyHint="done"
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-11 w-full rounded-md border px-3 py-2 text-sm tabular-nums focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <TouchNumpadButton
        value={value}
        onChange={onChange}
        allowDecimal={allowDecimal}
        maxFractionDigits={maxFractionDigits}
        disabled={disabled}
      />
    </div>
  );
}
