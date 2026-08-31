"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { digitsOnly } from "@/lib/quantity";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<typeof Input>, "type" | "inputMode" | "onChange"> & {
  value: string;
  onValueChange: (next: string) => void;
};

/** Integer quantity field that opens a digit keypad (no minus key). */
export function UnsignedQuantityInput({ value, onValueChange, className, ...props }: Props) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      enterKeyHint="done"
      {...props}
      className={cn("tabular-nums", className)}
      value={value}
      onChange={(event) => onValueChange(digitsOnly(event.target.value))}
    />
  );
}
