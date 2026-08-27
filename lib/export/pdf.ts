import { jsPDF } from "jspdf";
import { EXPORT_PDF_MAX_ROWS } from "@/convex/shared/capabilities";
import { APP_BRAND } from "@/constants/app";
import type { ExportTable } from "./types";

export function buildPdfBlob(table: ExportTable): Blob {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  let y = margin;

  doc.setFontSize(14);
  doc.text(`${APP_BRAND} — ${table.title}`, margin, y);
  y += 16;
  doc.setFontSize(9);
  doc.setTextColor(80);
  if (table.meta) {
    const meta = Object.entries(table.meta)
      .map(([k, v]) => `${k}: ${v}`)
      .join("   ");
    doc.text(meta.slice(0, 180), margin, y);
    y += 14;
  }
  doc.setTextColor(0);

  const usable = pageWidth - margin * 2;
  const colCount = Math.max(1, table.columns.length);
  const colWidth = usable / colCount;
  const rows = table.rows.slice(0, EXPORT_PDF_MAX_ROWS);

  const drawRow = (values: string[], header: boolean) => {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    if (header) doc.setFont("helvetica", "bold");
    else doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    values.forEach((value, i) => {
      const x = margin + i * colWidth;
      doc.text(value.slice(0, 42), x + 2, y, { maxWidth: colWidth - 4 });
    });
    y += 14;
  };

  drawRow(
    table.columns.map((c) => c.header),
    true,
  );
  for (const row of rows) {
    drawRow(
      table.columns.map((c) => String(row[c.key] ?? "")),
      false,
    );
  }

  if (table.rows.length > EXPORT_PDF_MAX_ROWS) {
    y += 8;
    doc.setFontSize(8);
    doc.text(
      `Showing first ${EXPORT_PDF_MAX_ROWS} rows of ${table.rows.length}. Export CSV or Excel for the full set.`,
      margin,
      y,
    );
  }

  return doc.output("blob");
}
