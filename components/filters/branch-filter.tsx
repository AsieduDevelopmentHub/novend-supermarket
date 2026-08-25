"use client";

import { Id } from "@/convex/_generated/dataModel";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";

export type BranchOption = {
  id?: Id<"branches">;
  _id?: Id<"branches">;
  name: string;
  code?: string;
};

type Props = {
  branches: BranchOption[] | undefined;
  value: Id<"branches"> | "all" | null;
  onChange: (value: Id<"branches"> | "all") => void;
  /** When true, show All branches option (admin consolidated views). */
  allowAll?: boolean;
  /** Locked display (manager/cashier) — no select. */
  lockedLabel?: string | null;
  label?: string;
  id?: string;
  className?: string;
  /**
   * Toolbar mode: hide the stacked label, match control height to adjacent CTAs.
   * Use for page-header action rows (Dashboard, etc.).
   */
  inline?: boolean;
  triggerClassName?: string;
};

function branchId(branch: BranchOption): Id<"branches"> | undefined {
  return branch.id ?? branch._id;
}

export function BranchFilter({
  branches,
  value,
  onChange,
  allowAll = true,
  lockedLabel,
  label = "Branch",
  id = "branch-filter",
  className,
  inline = false,
  triggerClassName,
}: Props) {
  if (lockedLabel) {
    return (
      <div className={className}>
        {inline ? (
          <p
            id={id}
            className="border-input bg-background text-foreground flex h-9 items-center truncate rounded-md border px-3 text-sm"
          >
            <span className="sr-only">{label}: </span>
            {lockedLabel}
          </p>
        ) : (
          <>
            <Label htmlFor={id}>{label}</Label>
            <p id={id} className="text-muted-foreground mt-1 text-sm">
              {lockedLabel}
            </p>
          </>
        )}
      </div>
    );
  }

  const selectValue = value === null || value === undefined ? (allowAll ? "all" : "") : value;

  const options = [
    ...(allowAll ? [{ value: "all", label: "All branches" }] : []),
    ...(branches ?? []).flatMap((branch) => {
      const idValue = branchId(branch);
      if (!idValue) return [];
      return [
        {
          value: idValue,
          label: branch.name,
          keywords: branch.code,
        },
      ];
    }),
  ];

  return (
    <div className={className}>
      {inline ? (
        <Label htmlFor={id} className="sr-only">
          {label}
        </Label>
      ) : (
        <Label htmlFor={id}>{label}</Label>
      )}
      <SearchableSelect
        id={id}
        className={inline ? undefined : "mt-1"}
        triggerClassName={cn(
          inline ? "h-9 min-w-0 w-full sm:min-w-[10rem] sm:w-[200px]" : "min-w-[10rem] sm:w-[200px]",
          triggerClassName,
        )}
        options={options}
        value={selectValue || undefined}
        onValueChange={(next) => {
          if (next === "all") onChange("all");
          else onChange(next as Id<"branches">);
        }}
        placeholder="Select branch"
        searchPlaceholder="Search branches…"
        emptyMessage="No branches found."
      />
    </div>
  );
}
