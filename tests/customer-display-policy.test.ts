import { describe, expect, it } from "vitest";
import {
  CUSTOMER_DISPLAY_SINGLE_MONITOR_MESSAGE,
  hasSecondaryDisplay,
} from "@/lib/desktop/customer-display-policy";

describe("customer display policy", () => {
  it("requires at least two displays", () => {
    expect(hasSecondaryDisplay(0)).toBe(false);
    expect(hasSecondaryDisplay(1)).toBe(false);
    expect(hasSecondaryDisplay(2)).toBe(true);
    expect(hasSecondaryDisplay(3)).toBe(true);
  });

  it("documents the single-monitor message", () => {
    expect(CUSTOMER_DISPLAY_SINGLE_MONITOR_MESSAGE).toMatch(/second monitor/i);
  });
});
