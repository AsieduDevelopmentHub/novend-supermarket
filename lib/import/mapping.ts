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
 * Suggest a 1:1 mapping. Each Novend field is used at most once. Uncertain
 * matches stay unmapped so the user can correct them.
 */
export function suggestColumnMapping(headers: string[]): MappingSuggestion[] {
  const used = new Set<ProductImportFieldKey>();
  const suggestions: MappingSuggestion[] = [];

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (!normalized) {
      suggestions.push({ header, field: null, confidence: "none" });
      continue;
    }
    let bestKey: ProductImportFieldKey | null = null;
    let bestScore = 0;
    for (const field of PRODUCT_IMPORT_FIELDS) {
      if (used.has(field.key)) continue;
      const score = fieldScore(normalized, field);
      if (score > bestScore) {
        bestScore = score;
        bestKey = field.key;
      }
    }
    const confidence = confidenceForScore(bestScore);
    const field = confidence === "none" || confidence === "low" ? null : bestKey;
    if (field && (confidence === "high" || confidence === "medium")) {
      used.add(field);
      suggestions.push({ header, field, confidence });
    } else {
      suggestions.push({ header, field: null, confidence });
    }
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
