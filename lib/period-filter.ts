export type PeriodPreset =
  | "today"
  | "this_week"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "this_quarter"
  | "this_year"
  | "custom";

export type PeriodRange = { start: string; end: string };

export const PERIOD_PRESET_OPTIONS: Array<{ value: PeriodPreset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "this_year", label: "This year" },
  { value: "custom", label: "Custom dates" },
];

export function isPeriodPreset(value: unknown): value is PeriodPreset {
  return PERIOD_PRESET_OPTIONS.some((option) => option.value === value);
}

export function periodPresetLabel(value: PeriodPreset): string {
  return PERIOD_PRESET_OPTIONS.find((option) => option.value === value)?.label ?? "Custom dates";
}

/** One-word window for tight KPI titles. The page header keeps the full label. */
export function periodPresetShortLabel(value: PeriodPreset): string {
  switch (value) {
    case "today":
      return "Today";
    case "this_week":
      return "Week";
    case "last_7_days":
      return "7d";
    case "last_30_days":
      return "30d";
    case "this_month":
      return "Month";
    case "this_quarter":
      return "Quarter";
    case "this_year":
      return "Year";
    case "custom":
      return "Custom";
  }
}

export function localIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function resolvePeriodPreset(
  preset: Exclude<PeriodPreset, "custom">,
  now = new Date(),
): PeriodRange {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);

  switch (preset) {
    case "today":
      break;
    case "this_week": {
      const day = start.getDay() || 7;
      start.setDate(start.getDate() - day + 1);
      break;
    }
    case "last_7_days":
      start.setDate(start.getDate() - 6);
      break;
    case "last_30_days":
      start.setDate(start.getDate() - 29);
      break;
    case "this_month":
      start.setDate(1);
      break;
    case "this_quarter":
      start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
      break;
    case "this_year":
      start.setMonth(0, 1);
      break;
  }

  return { start: localIsoDate(start), end: localIsoDate(end) };
}

export function recommendedGranularity(
  preset: PeriodPreset,
): "day" | "week" | "month" | "year" {
  if (preset === "this_year") return "month";
  if (preset === "this_quarter") return "week";
  return "day";
}

/** Matches Convex `dashboard.summary` max span (inclusive calendar days ≈ 370). */
export const MAX_DASHBOARD_PERIOD_MS = 370 * 24 * 60 * 60 * 1000;

/** Clamp a ms range so Convex date queries do not reject long custom windows. */
export function clampPeriodRangeMs(range: {
  startDate: number;
  endDate: number;
}): { startDate: number; endDate: number } {
  const { startDate, endDate } = range;
  if (!Number.isFinite(startDate) || !Number.isFinite(endDate) || endDate < startDate) {
    return range;
  }
  if (endDate - startDate <= MAX_DASHBOARD_PERIOD_MS) return range;
  return { startDate: endDate - MAX_DASHBOARD_PERIOD_MS, endDate };
}
