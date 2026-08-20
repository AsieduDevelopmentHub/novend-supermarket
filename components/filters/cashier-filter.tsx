"use client";

import { Id } from "@/convex/_generated/dataModel";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";

export type CashierOption = {
  userId: Id<"users">;
  name: string;
};

type Props = {
  cashiers: CashierOption[] | undefined;
  value: Id<"users"> | "all" | null;
  onChange: (value: Id<"users"> | "all") => void;
  lockedLabel?: string | null;
  label?: string;
  id?: string;
  className?: string;
};

export function CashierFilter({
  cashiers,
  value,
  onChange,
  lockedLabel,
  label = "Cashier",
  id = "cashier-filter",
  className,
}: Props) {
  if (lockedLabel) {
    return (
      <div className={className}>
        <Label htmlFor={id}>{label}</Label>
        <p id={id} className="text-muted-foreground mt-1 text-sm">
          {lockedLabel}
        </p>
      </div>
    );
  }

  const selectValue = value === null || value === undefined ? "all" : value;
  const options = [
    { value: "all", label: "All cashiers" },
    ...(cashiers ?? []).map((cashier) => ({
      value: cashier.userId,
      label: cashier.name,
    })),
  ];

  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <SearchableSelect
        id={id}
        className="mt-1"
        triggerClassName="min-w-[10rem] sm:w-[200px]"
        options={options}
        value={selectValue || undefined}
        onValueChange={(next) => {
          if (next === "all") onChange("all");
          else onChange(next as Id<"users">);
        }}
        placeholder="Select cashier"
        searchPlaceholder="Search cashiers…"
        emptyMessage="No cashiers found."
      />
    </div>
  );
}
