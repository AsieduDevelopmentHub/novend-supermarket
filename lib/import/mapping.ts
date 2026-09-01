import {
  PRODUCT_IMPORT_FIELDS,
  type ProductImportFieldKey,
} from "./product-fields";
import { normalizeHeader } from "./normalize";

export type ColumnMapping = Record<string, ProductImportFieldKey | null>;

export type MappingSuggestion = {
  header: string;
  field: ProductImportFieldKey | null;
  confidence: "high" | "medium" | "low" | "none";
};

const REQUIRED_FIELDS = PRODUCT_IMPORT_FIELDS.filter((field) => field.required).map(
  (field) => field.key,
);

function fieldScore(normalizedHeader: string, field: (typeof PRODUCT_IMPORT_FIELDS)[number]): number {
  const label = normalizeHeader(field.label);
  if (normalizedHeader === label) return 100;
  if (normalizedHeader === field.key.toLowerCase()) return 95;
  let best = 0;
  for (const synonym of field.synonyms) {
    const syn = normalizeHeader(synonym);
    if (normalizedHeader === syn) return 90;
    if (normalizedHeader.includes(syn) || syn.includes(normalizedHeader)) {
      best = Math.max(best, Math.min(normalizedHeader.length, syn.length) >= 3 ? 70 : 40);
    }
  }
  if (normalizedHeader.includes(label) || label.includes(normalizedHeader)) {
    best = Math.max(best, 65);
  }
  return best;
}

function confidenceForScore(score: number): MappingSuggestion["confidence"] {
  if (score >= 85) return "high";
  if (score >= 65) return "medium";
  if (score >= 40) return "low";
  return "none";
}

/**
 * Suggest a 1:1 mapping. Each Novend field is used at most once. Stronger
 * matches win first so a Novend export (`Product Name` + `Product ID`) does
 * not let the ID column steal the name field. Uncertain matches stay unmapped.
 */
export function suggestColumnMapping(headers: string[]): MappingSuggestion[] {
  type Candidate = {
    index: number;
    header: string;
    field: ProductImportFieldKey;
    score: number;
  };

  const candidates: Candidate[] = [];
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (!normalized) return;
    for (const field of PRODUCT_IMPORT_FIELDS) {
      const score = fieldScore(normalized, field);
      if (score >= 65) {
        candidates.push({ index, header, field: field.key, score });
      }
    }
  });
  candidates.sort((a, b) => b.score - a.score || a.index - b.index);

  const usedFields = new Set<ProductImportFieldKey>();
  const usedHeaders = new Set<number>();
  const suggestions: MappingSuggestion[] = headers.map((header) => ({
    header,
    field: null,
    confidence: "none" as const,
  }));

  for (const candidate of candidates) {
    if (usedHeaders.has(candidate.index) || usedFields.has(candidate.field)) continue;
    usedHeaders.add(candidate.index);
    usedFields.add(candidate.field);
    suggestions[candidate.index] = {
      header: candidate.header,
      field: candidate.field,
      confidence: confidenceForScore(candidate.score),
    };
  }

  return suggestions;
}

export function mappingFromSuggestions(suggestions: MappingSuggestion[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const row of suggestions) {
    mapping[row.header] = row.field;
  }
  return mapping;
}

export function unmappedRequiredFields(mapping: ColumnMapping): ProductImportFieldKey[] {
  const mapped = new Set(Object.values(mapping).filter(Boolean) as ProductImportFieldKey[]);
  return REQUIRED_FIELDS.filter((key) => !mapped.has(key));
}

export function appliedFieldKeys(mapping: ColumnMapping): ProductImportFieldKey[] {
  return [...new Set(Object.values(mapping).filter(Boolean) as ProductImportFieldKey[])];
}
