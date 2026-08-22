import { describe, expect, it } from "vitest";
import { brandedCsvName, brandedDocumentName } from "@/lib/export-filenames";

describe("branded export filenames", () => {
  it("builds receipt document names", () => {
    expect(brandedDocumentName("Receipt", "INV-00012")).toBe("Novend-Receipt-INV-00012");
  });

  it("adds extensions when provided", () => {
    expect(brandedDocumentName("Offline-Backup", "2026-08-22", "json")).toBe(
      "Novend-Offline-Backup-2026-08-22.json",
    );
  });

  it("builds csv export names", () => {
    expect(brandedCsvName("Products")).toBe("Novend-Products.csv");
    expect(brandedCsvName("Analytics", "2026-01-01-to-2026-01-31")).toBe(
      "Novend-Analytics-2026-01-01-to-2026-01-31.csv",
    );
  });
});
