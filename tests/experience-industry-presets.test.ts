import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_NOVEND_EXPERIENCE,
  HOTEL_EXPERIENCE,
  RESTAURANT_EXPERIENCE,
  deriveChartPalette,
  experiencePresetForIndustry,
} from "@/convex/shared/experience";
import { sumInventoryValues } from "@/convex/shared/dashboardFinance";

describe("experiencePresetForIndustry", () => {
  it("returns warm amber for restaurant and teal for hotel", () => {
    expect(experiencePresetForIndustry("restaurant").accent).toBe(RESTAURANT_EXPERIENCE.accent);
    expect(experiencePresetForIndustry("hotel").accent).toBe(HOTEL_EXPERIENCE.accent);
    expect(experiencePresetForIndustry("retail").accent).toBe(DEFAULT_NOVEND_EXPERIENCE.accent);
  });

  it("is used for org provisioning seed, not pack save", () => {
    const provision = readFileSync(
      resolve(process.cwd(), "convex/shared/provisionOrganization.ts"),
      "utf8",
    );
    expect(provision).toMatch(/experiencePresetForIndustry/);
    expect(provision).toMatch(/experienceOverrides/);

    const settings = readFileSync(resolve(process.cwd(), "convex/settings.ts"), "utf8");
    // Pack / capability save must preserve brand colours (gpt §10 / finding #12).
    expect(settings).not.toMatch(
      /if \(args\.applyIndustryPack\) \{\s*const tokens = experiencePresetForIndustry/,
    );
  });
});

describe("deriveChartPalette", () => {
  it("anchors chart-1 on the accent and keeps five stops", () => {
    const palette = deriveChartPalette("#f59e0b");
    expect(palette.chart1).toBe("#f59e0b");
    expect(palette.chart2).toMatch(/^#[0-9a-f]{6}$/);
    expect(palette.chart3).toMatch(/^#[0-9a-f]{6}$/);
    expect(palette.chart4).toBe(DEFAULT_NOVEND_EXPERIENCE.success);
    expect(palette.chart5).toBe(DEFAULT_NOVEND_EXPERIENCE.warning);
  });

  it("falls back to Candy Blue for invalid hex", () => {
    expect(deriveChartPalette("not-a-color").chart1).toBe(DEFAULT_NOVEND_EXPERIENCE.accent);
  });
});

describe("sumInventoryValues", () => {
  it("sums cost and sell values and skips non-stock lines", () => {
    const total = sumInventoryValues([
      { onHand: 10, costPrice: 2, sellingPrice: 5, tracksInventory: true },
      { onHand: 100, costPrice: 1, sellingPrice: 9, tracksInventory: false },
      { onHand: 3, costPrice: 4, sellingPrice: 8 },
    ]);
    expect(total.cost).toBe(32);
    expect(total.sell).toBe(74);
  });
});
