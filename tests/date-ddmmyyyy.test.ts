import { describe, expect, it } from "vitest";
import { formatIsoDateAsDdMmYyyy, parseDdMmYyyyToIso } from "@/lib/date";

describe("dd/mm/yyyy product expiry helpers", () => {
  it("formats ISO dates for display", () => {
    expect(formatIsoDateAsDdMmYyyy("2026-09-28")).toBe("28/09/2026");
    expect(formatIsoDateAsDdMmYyyy("2026-02-01")).toBe("01/02/2026");
    expect(formatIsoDateAsDdMmYyyy("")).toBe("");
    expect(formatIsoDateAsDdMmYyyy("not-a-date")).toBe("");
  });

  it("parses dd/mm/yyyy into ISO", () => {
    expect(parseDdMmYyyyToIso("28/09/2026")).toBe("2026-09-28");
    expect(parseDdMmYyyyToIso("1/2/2026")).toBe("2026-02-01");
    expect(parseDdMmYyyyToIso("28-09-2026")).toBe("2026-09-28");
    expect(parseDdMmYyyyToIso("28.09.2026")).toBe("2026-09-28");
  });

  it("rejects impossible calendar dates", () => {
    expect(parseDdMmYyyyToIso("31/02/2026")).toBeNull();
    expect(parseDdMmYyyyToIso("00/01/2026")).toBeNull();
    expect(parseDdMmYyyyToIso("32/01/2026")).toBeNull();
    expect(parseDdMmYyyyToIso("13/13/2026")).toBeNull();
    expect(parseDdMmYyyyToIso("abc")).toBeNull();
  });
});
