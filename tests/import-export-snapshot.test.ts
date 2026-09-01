import { describe, expect, it } from "vitest";
import {
  countExportFormats,
  parseLimitOverrideAuditMetadata,
} from "@/convex/shared/importExportSnapshot";

describe("countExportFormats", () => {
  it("tallies known formats and ignores case", () => {
    expect(
      countExportFormats([
        { format: "csv" },
        { format: "CSV" },
        { format: "xlsx" },
        { format: "pdf" },
        { format: "json" },
        { format: "other" },
      ]),
    ).toEqual({ csv: 2, xlsx: 1, pdf: 1, json: 1, other: 1 });
  });
});

describe("parseLimitOverrideAuditMetadata", () => {
  it("reads the saved override snapshot after a Super Admin save", () => {
    expect(parseLimitOverrideAuditMetadata(JSON.stringify({ products: 80, users: null }))).toEqual({
      products: 80,
      users: null,
    });
  });

  it("ignores malformed metadata", () => {
    expect(parseLimitOverrideAuditMetadata("not-json")).toBeNull();
    expect(parseLimitOverrideAuditMetadata(undefined)).toBeNull();
  });
});
