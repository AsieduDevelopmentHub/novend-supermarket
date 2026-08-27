import type { PlanCapabilities } from "./capabilities";
import { capabilityDeniedMessage } from "./capabilities";
import { brandedDocumentName } from "@/lib/export-filenames";
import { buildCsvText } from "./csv";
import { buildJsonText } from "./json";
import { buildPdfBlob } from "./pdf";
import { buildXlsxBytes } from "./xlsx";
import { bytesToBlob, downloadBlob } from "./download";
import type { ExportFormat, ExportTable } from "./types";

export function formatAllowed(format: ExportFormat, capabilities: PlanCapabilities): boolean {
  switch (format) {
    case "csv":
      return capabilities.canExportCsv;
    case "json":
      return capabilities.canExportJson;
    case "xlsx":
      return capabilities.canExportXlsx;
    case "pdf":
      return capabilities.canExportPdf;
  }
}

export function exportFilename(table: ExportTable, format: ExportFormat): string {
  return brandedDocumentName(table.filenameKind, table.filenameSuffix, format);
}

export async function runExport(args: {
  table: ExportTable;
  format: ExportFormat;
  capabilities: PlanCapabilities;
  planName: string;
}): Promise<{ filename: string; rows: number }> {
  const { table, format, capabilities, planName } = args;
  if (!formatAllowed(format, capabilities)) {
    const key =
      format === "xlsx" ? "canExportXlsx" : format === "pdf" ? "canExportPdf" : "canExportCsv";
    throw new Error(capabilityDeniedMessage(key, planName));
  }

  const filename = exportFilename(table, format);
  if (format === "csv") {
    downloadBlob(filename, new Blob([buildCsvText(table)], { type: "text/csv;charset=utf-8" }));
  } else if (format === "json") {
    downloadBlob(
      filename,
      new Blob([buildJsonText(table)], { type: "application/json;charset=utf-8" }),
    );
  } else if (format === "xlsx") {
    const bytes = buildXlsxBytes(table);
    downloadBlob(
      filename,
      bytesToBlob(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    );
  } else {
    downloadBlob(filename, buildPdfBlob(table));
  }
  return { filename, rows: table.rows.length };
}
