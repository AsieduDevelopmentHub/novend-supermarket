import type { ColumnMapping } from "./mapping";

const prefix = (organizationId: string) => `novend.importMapping.products:${organizationId}`;

export type SavedMapping = {
  name: string;
  mapping: ColumnMapping;
  savedAt: number;
};

export function loadLocalMappings(organizationId: string): SavedMapping[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(prefix(organizationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedMapping[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalMapping(
  organizationId: string,
  name: string,
  mapping: ColumnMapping,
): SavedMapping[] {
  const next = [
    { name: name.trim() || "Default", mapping, savedAt: Date.now() },
    ...loadLocalMappings(organizationId).filter((row) => row.name !== name.trim()),
  ].slice(0, 12);
  window.localStorage.setItem(prefix(organizationId), JSON.stringify(next));
  return next;
}
