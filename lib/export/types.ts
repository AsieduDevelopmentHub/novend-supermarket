export type ExportColumn = {
  key: string;
  header: string;
};

export type ExportFormat = "csv" | "xlsx" | "pdf" | "json";

export type ExportTable = {
  title: string;
  filenameKind: string;
  filenameSuffix?: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  meta?: Record<string, string>;
};
