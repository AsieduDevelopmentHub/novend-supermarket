import { describe, expect, it } from "vitest";
import { businessDateKey, resolveReportedClockIn } from "@/convex/shared/businessDate";
import { phonesForBroadcast, phonesForClockInAlert } from "@/convex/shared/smsAudience";

const profiles = [
  { userId: "owner", role: "administrator", status: "active", phone: "0244000001" },
  { userId: "admin", role: "administrator", status: "active", phone: "0244000002" },
  { userId: "manager", role: "manager", status: "active", phone: "0244000003" },
  { userId: "cashier", role: "cashier", status: "active", phone: "0244000004" },
  { userId: "inactive", role: "administrator", status: "inactive", phone: "0244000005" },
];

describe("phonesForBroadcast", () => {
  it("reaches owners, administrators, and managers, and never cashiers", () => {
    const phones = phonesForBroadcast({
      audiences: ["owners", "administrators", "managers"],
      profiles,
      ownerUserIds: ["owner"],
    });
    expect(phones).toEqual(["+233244000001", "+233244000002", "+233244000003"]);
  });

  it("dedupes an owner who is also an administrator", () => {
    const phones = phonesForBroadcast({
      audiences: ["owners", "administrators"],
      profiles,
      ownerUserIds: ["owner"],
    });
    expect(phones.filter((phone) => phone === "+233244000001")).toHaveLength(1);
  });
});

describe("phonesForClockInAlert", () => {
  it("texts administrators and the owner, not the cashier", () => {
    expect(
      phonesForClockInAlert({
        cashierUserId: "cashier",
        ownerUserId: "owner",
        profiles,
      }),
    ).toEqual(["+233244000001", "+233244000002"]);
  });
});

describe("resolveReportedClockIn", () => {
  const now = Date.parse("2026-10-07T09:30:00.000Z");

  it("keeps the till's earlier login instead of the reconnect time", () => {
    const loggedIn = Date.parse("2026-10-07T07:00:00.000Z");
    const result = resolveReportedClockIn({
      now,
      reportedAt: loggedIn,
      timeZone: "Africa/Accra",
    });
    expect(result.record).toBe(true);
    expect(result.at).toBe(loggedIn);
    expect(result.on).toBe("2026-10-07");
  });

  it("does not replace a clock-in already stored for a later day", () => {
    const result = resolveReportedClockIn({
      now,
      reportedAt: Date.parse("2026-10-06T18:00:00.000Z"),
      existingOn: "2026-10-07",
      timeZone: "Africa/Accra",
    });
    expect(result.record).toBe(false);
  });
});

describe("businessDateKey", () => {
  it("uses the business timezone day", () => {
    const at = Date.parse("2026-10-07T23:30:00.000Z");
    expect(businessDateKey(at, "Africa/Accra")).toBe("2026-10-07");
    expect(businessDateKey(at, "Pacific/Auckland")).toBe("2026-10-08");
  });
});
