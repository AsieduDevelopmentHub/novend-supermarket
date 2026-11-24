import { describe, expect, it } from "vitest";

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

describe("product duplicate grouping", () => {
  it("groups exact names ignoring case and extra spaces", () => {
    expect(normalizeName("  Milo  300ml ")).toBe("milo 300ml");
    expect(normalizeName("Milo 300ml")).toBe(normalizeName("milo   300ml"));
  });

  it("keeps distinct pack sizes as separate names", () => {
    expect(normalizeName("Sugar 1kg")).not.toBe(normalizeName("Sugar 500g"));
  });
});
