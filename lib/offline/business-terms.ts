import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";
import {
  DEFAULT_BUSINESS_TERMS,
  parseBusinessTerminologyOverrides,
  resolveBusinessTerms,
  type BusinessTerminologyOverrides,
  type BusinessTermsMap,
} from "@/convex/shared/businessTerms";
import type { IndustryProfile } from "@/convex/shared/businessCapabilities";

export type CachedBusinessTerminology = {
  industryProfile: IndustryProfile | string;
  overrides: BusinessTerminologyOverrides;
  terms: BusinessTermsMap;
};

export async function saveBusinessTermsCache(cache: CachedBusinessTerminology): Promise<void> {
  const db = await getOfflineDb();
  if (!db) return;
  await setMeta(db, META_KEYS.businessTerminology, JSON.stringify(cache));
}

export async function loadBusinessTermsCache(): Promise<CachedBusinessTerminology> {
  const db = await getOfflineDb();
  if (!db) {
    return {
      industryProfile: "retail",
      overrides: {},
      terms: { ...DEFAULT_BUSINESS_TERMS },
    };
  }
  const raw = await getMeta(db, META_KEYS.businessTerminology);
  if (!raw) {
    return {
      industryProfile: "retail",
      overrides: {},
      terms: { ...DEFAULT_BUSINESS_TERMS },
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<CachedBusinessTerminology>;
    const industryProfile = parsed.industryProfile ?? "retail";
    const overrides = parseBusinessTerminologyOverrides(
      parsed.overrides ? JSON.stringify(parsed.overrides) : null,
    );
    const terms =
      parsed.terms && typeof parsed.terms === "object"
        ? resolveBusinessTerms(industryProfile, { ...overrides, ...parsed.terms })
        : resolveBusinessTerms(industryProfile, overrides);
    return { industryProfile, overrides, terms };
  } catch {
    return {
      industryProfile: "retail",
      overrides: {},
      terms: { ...DEFAULT_BUSINESS_TERMS },
    };
  }
}

/** Persist resolved terms for offline nav / headers after a capabilities or terminology save. */
export async function cacheResolvedBusinessTerms(
  industryProfile: IndustryProfile | string,
  overrides: BusinessTerminologyOverrides = {},
): Promise<BusinessTermsMap> {
  const terms = resolveBusinessTerms(industryProfile, overrides);
  await saveBusinessTermsCache({ industryProfile, overrides, terms });
  return terms;
}
