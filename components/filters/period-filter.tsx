"use client";

import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  PERIOD_PRESET_OPTIONS,
  type PeriodPreset,
} from "@/lib/period-filter";
import { cn } from "@/lib/utils";

export function PeriodFilter({
  preset,
  start,
  end,
  onPresetChange,
  onCustomRangeChange,
  className,
  /**
   * Toolbar mode: hide the stacked label, match control height to adjacent filters.
   * Use for page-header action rows (Dashboard, etc.).
   */
  inline = false,
}: {
  preset: PeriodPreset;
  start: string;
  end: string;
  onPresetChange: (preset: PeriodPreset) => void;
  onCustomRangeChange: (range: { start: string; end: string }) => void;
  className?: string;
  inline?: boolean;
}) {
  return (
    <div
      className={cn(
        inline
          ? "flex min-w-0 items-center gap-2"
          : "flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {inline ? (
          <p className="sr-only">Period</p>
        ) : (
          <p className="text-muted-foreground text-xs">Period</p>
        )}
        <SearchableSelect
          options={PERIOD_PRESET_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          value={preset}
          onValueChange={(value) => onPresetChange(value as PeriodPreset)}
          placeholder="Period"
          searchPlaceholder="Search periods…"
          emptyMessage="No period found."
          triggerClassName={cn(
            "min-w-0 shrink [&>span]:min-w-0 [&>span]:truncate",
            inline
              ? "h-9 w-[9.75rem] sm:w-[10.5rem]"
              : "h-10 w-full max-w-[11rem] sm:h-9 sm:w-[10.5rem]",
          )}
        />
      </div>
      {preset === "custom" ? (
        <>
          <div className="min-w-0 space-y-1">
            {inline ? (
              <p className="sr-only">Start</p>
            ) : (
              <p className="text-muted-foreground text-xs">Start</p>
            )}
            <Input
              type="date"
              value={start}
              className={inline ? "h-9" : undefined}
              onChange={(event) => onCustomRangeChange({ start: event.target.value, end })}
            />
          </div>
          <div className="min-w-0 space-y-1">
            {inline ? (
              <p className="sr-only">End</p>
            ) : (
              <p className="text-muted-foreground text-xs">End</p>
            )}
            <Input
              type="date"
              value={end}
              className={inline ? "h-9" : undefined}
              onChange={(event) => onCustomRangeChange({ start, end: event.target.value })}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
