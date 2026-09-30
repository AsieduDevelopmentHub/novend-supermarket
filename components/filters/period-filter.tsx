"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PERIOD_PRESET_OPTIONS,
  type PeriodPreset,
} from "@/lib/period-filter";

export function PeriodFilter({
  preset,
  start,
  end,
  onPresetChange,
  onCustomRangeChange,
  className,
}: {
  preset: PeriodPreset;
  start: string;
  end: string;
  onPresetChange: (preset: PeriodPreset) => void;
  onCustomRangeChange: (range: { start: string; end: string }) => void;
  className?: string;
}) {
  return (
    <div className={className ?? "flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end"}>
      <div className="min-w-0 space-y-1">
        <p className="text-muted-foreground text-xs">Period</p>
        <Select value={preset} onValueChange={(value) => onPresetChange(value as PeriodPreset)}>
          <SelectTrigger className="w-full min-w-[150px] sm:w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_PRESET_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {preset === "custom" ? (
        <>
          <div className="min-w-0 space-y-1">
            <p className="text-muted-foreground text-xs">Start</p>
            <Input
              type="date"
              value={start}
              onChange={(event) => onCustomRangeChange({ start: event.target.value, end })}
            />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-muted-foreground text-xs">End</p>
            <Input
              type="date"
              value={end}
              onChange={(event) => onCustomRangeChange({ start, end: event.target.value })}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
