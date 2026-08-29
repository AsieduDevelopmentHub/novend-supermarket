import { describe, expect, it } from "vitest";
import { buildMultiSheetXlsxBytes } from "@/lib/export/xlsx";

describe("platform analytics workbook", () => {
  it("creates a multi-sheet XLSX package", () => {
    const bytes = buildMultiSheetXlsxBytes([
      {
        name: "Executive Summary",
        table: {
          title: "Executive Summary",
          filenameKind: "platform",
          columns: [{ key: "metric", header: "Metric" }],
          rows: [{ metric: "Monthly active users" }],
        },
      },
      {
        name: "Runtime Distribution",
        table: {
          title: "Runtime Distribution",
          filenameKind: "platform",
          columns: [{ key: "runtime", header: "Runtime" }],
          rows: [{ runtime: "PWA" }],
        },
      },
    ]);

    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    const packageText = new TextDecoder().decode(bytes);
    expect(packageText).toContain("xl/worksheets/sheet1.xml");
    expect(packageText).toContain("xl/worksheets/sheet2.xml");
    expect(packageText).toContain("Executive Summary");
  });
});
