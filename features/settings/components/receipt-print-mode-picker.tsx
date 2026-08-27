"use client";

import { Ban, Printer, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReceiptPrintMode } from "@/lib/receipt-print-mode";

const OPTIONS: Array<{
  value: ReceiptPrintMode;
  title: string;
  description: string;
  icon: typeof Printer;
}> = [
  {
    value: "automatic",
    title: "Automatic print",
    description: "Print immediately after every completed sale.",
    icon: Printer,
  },
  {
    value: "manual",
    title: "Manual print",
    description: "Finish the sale, then print from the receipt dialog. On phones, Print is first.",
    icon: Receipt,
  },
  {
    value: "never",
    title: "Do not print",
    description: "Never prompt or automatically print receipts.",
    icon: Ban,
  },
];

export function ReceiptPrintModePicker({
  value,
  onChange,
  disabled = false,
  showIntro = true,
}: {
  value: ReceiptPrintMode;
  onChange: (mode: ReceiptPrintMode) => void;
  disabled?: boolean;
  showIntro?: boolean;
}) {
  return (
    <div className="space-y-3">
      {showIntro ? (
        <div>
          <p className="text-sm font-semibold">After a sale</p>
          <p className="text-muted-foreground text-sm">
            How this business handles receipts. Administrators and managers can change this.
          </p>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-3">
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                selected
                  ? "border-primary bg-accent ring-primary/30 ring-2"
                  : "border-border hover:border-primary/40 bg-card",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <Icon
                className={cn("mb-3 h-5 w-5", selected ? "text-primary" : "text-muted-foreground")}
              />
              <p className="font-semibold">{option.title}</p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>
      {value === "never" ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs">
          Receipts are not printed after sales. Cashiers still see the sale confirmation.
        </p>
      ) : null}
    </div>
  );
}
