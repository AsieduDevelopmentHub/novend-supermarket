import { jsPDF } from "jspdf";
import { EXPORT_PDF_MAX_ROWS } from "@/convex/shared/capabilities";
import { APP_BRAND } from "@/constants/app";
import type { ExportTable } from "./types";
import { pdfColumnWidths, pdfView } from "./pdf-layout";

const MARGIN = 40;
const TITLE_SIZE = 13;
const META_SIZE = 8;
const CELL_SIZE = 7.5;
const LINE = 10;
const CELL_PAD_X = 4;
const CELL_PAD_Y = 5;
const HEADER_FILL: [number, number, number] = [15, 118, 110];
const GRID: [number, number, number] = [226, 232, 240];
const MUTED: [number, number, number] = [71, 85, 105];

export function buildPdfBlob(table: ExportTable): Blob {
  const view = pdfView(table);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usable = pageWidth - MARGIN * 2;
  const widths = pdfColumnWidths(view.columns, usable);
  const rows = view.rows.slice(0, EXPORT_PDF_MAX_ROWS);
  let y = MARGIN;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(TITLE_SIZE);
  doc.setTextColor(15, 23, 42);
  doc.text(`${APP_BRAND} — ${table.title}`, MARGIN, y);
  y += 16;

  if (table.meta) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(META_SIZE);
    doc.setTextColor(...MUTED);
    const meta = Object.entries(table.meta)
      .map(([k, v]) => `${k}: ${v}`)
      .join("  ·  ");
    const metaLines = doc.splitTextToSize(meta, usable) as string[];
    doc.text(metaLines, MARGIN, y);
    y += metaLines.length * 10 + 6;
  }

  y += 4;
  drawHeader(doc, view.columns, widths, y);
  y += headerHeight(doc, view.columns, widths);

  for (const row of rows) {
    const values = view.columns.map((col) => formatCell(row[col.key]));
    const height = rowHeight(doc, values, widths);
    if (y + height > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
      drawHeader(doc, view.columns, widths, y);
      y += headerHeight(doc, view.columns, widths);
    }
    drawBodyRow(doc, values, widths, y, height);
    y += height;
  }

  if (table.rows.length > EXPORT_PDF_MAX_ROWS) {
    y += 12;
    if (y > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(META_SIZE);
    doc.setTextColor(...MUTED);
    doc.text(
      `Showing first ${EXPORT_PDF_MAX_ROWS} of ${table.rows.length} rows. Use CSV or Excel for the full set.`,
      MARGIN,
      y,
    );
  }

  return doc.output("blob");
}

function formatCell(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value)
      ? String(value)
      : value.toLocaleString("en-GH", { maximumFractionDigits: 2 });
  }
  return String(value);
}

function wrapped(doc: jsPDF, text: string, width: number): string[] {
  const inner = Math.max(12, width - CELL_PAD_X * 2);
  return doc.splitTextToSize(text, inner) as string[];
}

function headerHeight(doc: jsPDF, columns: ExportTable["columns"], widths: number[]): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(CELL_SIZE);
  let lines = 1;
  columns.forEach((col, i) => {
    lines = Math.max(lines, wrapped(doc, col.header, widths[i]).length);
  });
  return lines * LINE + CELL_PAD_Y * 2;
}

function rowHeight(doc: jsPDF, values: string[], widths: number[]): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(CELL_SIZE);
  let lines = 1;
  values.forEach((value, i) => {
    lines = Math.max(lines, wrapped(doc, value, widths[i]).length);
  });
  return Math.max(LINE + CELL_PAD_Y * 2, lines * LINE + CELL_PAD_Y * 2);
}

function drawHeader(doc: jsPDF, columns: ExportTable["columns"], widths: number[], y: number) {
  const height = headerHeight(doc, columns, widths);
  doc.setFillColor(...HEADER_FILL);
  doc.rect(
    MARGIN,
    y,
    widths.reduce((sum, w) => sum + w, 0),
    height,
    "F",
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(CELL_SIZE);
  doc.setTextColor(255, 255, 255);
  let x = MARGIN;
  columns.forEach((col, i) => {
    const lines = wrapped(doc, col.header, widths[i]);
    doc.text(lines, x + CELL_PAD_X, y + CELL_PAD_Y + 7);
    x += widths[i];
  });
}

function drawBodyRow(doc: jsPDF, values: string[], widths: number[], y: number, height: number) {
  doc.setDrawColor(...GRID);
  doc.setLineWidth(0.4);
  doc.rect(
    MARGIN,
    y,
    widths.reduce((sum, w) => sum + w, 0),
    height,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(CELL_SIZE);
  doc.setTextColor(15, 23, 42);
  let x = MARGIN;
  values.forEach((value, i) => {
    const lines = wrapped(doc, value, widths[i]);
    doc.text(lines, x + CELL_PAD_X, y + CELL_PAD_Y + 7);
    x += widths[i];
    if (i < values.length - 1) {
      doc.setDrawColor(...GRID);
      doc.line(x, y, x, y + height);
    }
  });
}
