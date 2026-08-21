import { describe, expect, it } from "vitest";
import { periodEnd } from "@/convex/shared/billingPeriod";

const JAN_31 = Date.UTC(2026, 0, 31, 12);

describe("billing periods", () => {
  it("adds one calendar month for monthly cycles", () => {
    const end = periodEnd(JAN_31, "monthly");
    expect(end).toBeDefined();
    const date = new Date(end!);
    expect(date.getUTCMonth()).toBe(1);
    expect(date.getUTCDate()).toBe(28);
  });

  it("adds twelve months for yearly cycles", () => {
    const start = Date.UTC(2026, 2, 15);
    const end = periodEnd(start, "yearly");
    expect(new Date(end!).getUTCFullYear()).toBe(2027);
    expect(new Date(end!).getUTCMonth()).toBe(2);
  });

  it("never expires a lifetime licence", () => {
    expect(periodEnd(JAN_31, "lifetime")).toBeUndefined();
  });
});
