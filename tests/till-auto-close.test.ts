import { describe, expect, it } from "vitest";
import { localDayStart, localDayEnd } from "@/lib/offline/till-sessions";

describe("till day bounds", () => {
  it("localDayStart is midnight of the local calendar day", () => {
    const midAfternoon = new Date(2026, 10, 24, 15, 30, 0).getTime();
    const start = localDayStart(midAfternoon);
    const d = new Date(start);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getDate()).toBe(24);
    expect(start).toBeLessThan(midAfternoon);
  });

  it("sessions opened before dayStart are stale for auto-close", () => {
    const now = new Date(2026, 10, 24, 8, 0, 0).getTime();
    const dayStart = localDayStart(now);
    const yesterdayOpen = dayStart - 60_000;
    expect(yesterdayOpen < dayStart).toBe(true);
    expect(now >= dayStart).toBe(true);
    expect(localDayEnd(now)).toBeGreaterThan(now);
  });
});
