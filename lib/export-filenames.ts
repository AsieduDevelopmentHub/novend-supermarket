import { APP_BRAND } from "@/constants/app";

function slugPart(value: string): string {
  return value.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "export";
}

/** Build a branded download or print document name, e.g. `Novend-Receipt-00012`. */
export function brandedDocumentName(kind: string, identifier?: string, extension?: string): string {
  const parts = [APP_BRAND, kind, identifier ? slugPart(identifier) : undefined].filter(Boolean);
  const base = parts.join("-");
  if (!extension) return base;
  return `${base}.${extension.replace(/^\./, "")}`;
}

/** Branded CSV export filename, e.g. `Novend-Products.csv`. */
export function brandedCsvName(kind: string, suffix?: string): string {
  return brandedDocumentName(kind, suffix, "csv");
}
