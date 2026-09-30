import { describe, expect, it } from "vitest";
import {
  clampPeriodRangeMs,
  MAX_DASHBOARD_PERIOD_MS,
  periodPresetLabel,
  recommendedGranularity,
  resolvePeriodPreset,
} from "@/lib/period-filter";

describe("business period presets", () => {
  const now = new Date(2026, 8, 30, 10, 30);

  it("resolves common periods using local calendar boundaries", () => {
    expect(resolvePeriodPreset("today", now)).toEqual({
      start: "2026-09-30",
      end: "2026-09-30",
    });
    expect(resolvePeriodPreset("this_week", now)).toEqual({
      start: "2026-09-28",
      end: "2026-09-30",
    });
    expect(resolvePeriodPreset("last_7_days", now)).toEqual({
      start: "2026-09-24",
      end: "2026-09-30",
    });
    expect(resolvePeriodPreset("last_30_days", now)).toEqual({
      start: "2026-09-01",
      end: "2026-09-30",
    });
    expect(resolvePeriodPreset("this_quarter", now)).toEqual({
      start: "2026-07-01",
      end: "2026-09-30",
    });
    expect(resolvePeriodPreset("this_year", now)).toEqual({
      start: "2026-01-01",
      end: "2026-09-30",
    });
  });

  it("provides readable labels and sensible chart granularity", () => {
    expect(periodPresetLabel("last_7_days")).toBe("Last 7 days");
    expect(recommendedGranularity("this_quarter")).toBe("week");
    expect(recommendedGranularity("this_year")).toBe("month");
  });

  it("clamps custom ranges to the Convex dashboard max span", () => {
    const endDate = Date.UTC(2026, 8, 30);
    const startDate = endDate - MAX_DASHBOARD_PERIOD_MS - 10 * 24 * 60 * 60 * 1000;
    const clamped = clampPeriodRangeMs({ startDate, endDate });
    expect(clamped.endDate).toBe(endDate);
    expect(clamped.endDate - clamped.startDate).toBe(MAX_DASHBOARD_PERIOD_MS);
  });
});
