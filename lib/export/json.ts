import type { ExportTable } from "./types";

export function buildJsonText(table: ExportTable): string {
  return JSON.stringify(
    {
      title: table.title,
      meta: table.meta ?? {},
      rows: table.rows.map((row) => {
        const next: Record<string, unknown> = {};
        for (const col of table.columns) next[col.key] = row[col.key] ?? null;
        return next;
      }),
    },
    null,
    2,
  );
}
