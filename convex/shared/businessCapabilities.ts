/**
 * Org-level business capability engine (industry packs / sell modes).
 *
 * Distinct from planCapabilities in `capabilities.ts` (import/export entitlements).
 * Principles: docs/architecture/NOVEND_CAPABILITY_EXPANSION.md
 * Delivery: docs/architecture/ROADMAP_CAPABILITIES.md (Stage 1)
 */

import { resolvePlan, type PlanKey } from "./plans";

/** Stage 1 configurationVersion — UOM adapter N is defined in Stage 2. */
export const BUSINESS_CAPABILITY_CONFIGURATION_VERSION = 1;

export const BUSINESS_CAPABILITY_KEYS = [
  "multi_unit_pricing",
  "sell_by_weight",
  "lot_expiry",
  "serial_tracking",
  "scale_hardware",
  "custom_fields",
  "configurable_pos",
] as const;

export type BusinessCapabilityKey = (typeof BUSINESS_CAPABILITY_KEYS)[number];

export const INDUSTRY_PROFILES = [
  "retail",
  "wholesale",
  "supermarket",
  "cold_store",
  "electronics",
  "pharmacy",
  "custom",
] as const;

export type IndustryProfile = (typeof INDUSTRY_PROFILES)[number];

export type BusinessCapabilityDefinition = {
  key: BusinessCapabilityKey;
  version: number;
  label: string;
  description: string;
  dependencies?: BusinessCapabilityKey[];
  conflicts?: BusinessCapabilityKey[];
  /** Minimum plan sortOrder (basic=0). */
  minPlanSortOrder: number;
};

export type OrganizationBusinessConfiguration = {
  industryProfile: IndustryProfile;
  enabledCapabilities: BusinessCapabilityKey[];
  capabilitySettings: Record<string, unknown>;
  configurationVersion: number;
};

export const DEFAULT_BUSINESS_CONFIGURATION: OrganizationBusinessConfiguration = {
  industryProfile: "retail",
  enabledCapabilities: [],
  capabilitySettings: {},
  configurationVersion: BUSINESS_CAPABILITY_CONFIGURATION_VERSION,
};

export const BUSINESS_CAPABILITY_REGISTRY: Record<
  BusinessCapabilityKey,
  BusinessCapabilityDefinition
> = {
  multi_unit_pricing: {
    key: "multi_unit_pricing",
    version: 1,
    label: "Multi-unit / pack pricing",
    description: "Sell packs and cartons with conversion to base inventory quantity.",
    minPlanSortOrder: resolvePlan("pro").sortOrder,
  },
  sell_by_weight: {
    key: "sell_by_weight",
    version: 1,
    label: "Sell by weight",
    description: "Price and deduct inventory by mass (manual weight; scale optional).",
    minPlanSortOrder: resolvePlan("pro").sortOrder,
  },
  lot_expiry: {
    key: "lot_expiry",
    version: 1,
    label: "Lots & expiry",
    description: "Dated inventory lots and FEFO where enabled.",
    minPlanSortOrder: resolvePlan("basic").sortOrder,
  },
  serial_tracking: {
    key: "serial_tracking",
    version: 1,
    label: "Serial / IMEI tracking",
    description: "Track high-value serialized units.",
    minPlanSortOrder: resolvePlan("pro").sortOrder,
  },
  scale_hardware: {
    key: "scale_hardware",
    version: 1,
    label: "Scale hardware",
    description: "Read weight from a connected scale (requires sell by weight).",
    dependencies: ["sell_by_weight"],
    minPlanSortOrder: resolvePlan("pro").sortOrder,
  },
  custom_fields: {
    key: "custom_fields",
    version: 1,
    label: "Custom fields",
    description: "Schema-controlled product and catalog fields.",
    minPlanSortOrder: resolvePlan("basic").sortOrder,
  },
  configurable_pos: {
    key: "configurable_pos",
    version: 1,
    label: "Configurable POS layouts",
    description: "POS layout presets (not a free-form page builder).",
    minPlanSortOrder: resolvePlan("basic").sortOrder,
  },
};

/** Industry packs are presets of capability keys — not hardcoded industry branches. */
export const INDUSTRY_PACKS: Record<IndustryProfile, BusinessCapabilityKey[]> = {
  retail: ["configurable_pos"],
  wholesale: ["multi_unit_pricing", "configurable_pos"],
  supermarket: ["multi_unit_pricing", "lot_expiry", "configurable_pos"],
  cold_store: ["sell_by_weight", "lot_expiry", "scale_hardware", "configurable_pos"],
  electronics: ["serial_tracking", "configurable_pos"],
  pharmacy: ["lot_expiry", "custom_fields", "configurable_pos"],
  custom: [],
};

export function isBusinessCapabilityKey(value: string): value is BusinessCapabilityKey {
  return (BUSINESS_CAPABILITY_KEYS as readonly string[]).includes(value);
}

export function isIndustryProfile(value: string): value is IndustryProfile {
  return (INDUSTRY_PROFILES as readonly string[]).includes(value);
}

export function hasBusinessCapability(
  config: OrganizationBusinessConfiguration | null | undefined,
  key: BusinessCapabilityKey,
): boolean {
  if (!config) return false;
  return config.enabledCapabilities.includes(key);
}

export function planAllowsBusinessCapability(
  planKey: PlanKey,
  capability: BusinessCapabilityKey,
): boolean {
  const def = BUSINESS_CAPABILITY_REGISTRY[capability];
  return resolvePlan(planKey).sortOrder >= def.minPlanSortOrder;
}

export function businessCapabilitiesAllowedOnPlan(planKey: PlanKey): BusinessCapabilityKey[] {
  return BUSINESS_CAPABILITY_KEYS.filter((key) => planAllowsBusinessCapability(planKey, key));
}

function expandWithDependencies(keys: BusinessCapabilityKey[]): BusinessCapabilityKey[] {
  const out = new Set<BusinessCapabilityKey>();
  const visit = (key: BusinessCapabilityKey) => {
    if (out.has(key)) return;
    out.add(key);
    for (const dep of BUSINESS_CAPABILITY_REGISTRY[key].dependencies ?? []) {
      visit(dep);
    }
  };
  for (const key of keys) visit(key);
  return BUSINESS_CAPABILITY_KEYS.filter((k) => out.has(k));
}

export function validateBusinessCapabilitySet(
  keys: BusinessCapabilityKey[],
  planKey: PlanKey,
): { ok: true; keys: BusinessCapabilityKey[] } | { ok: false; message: string } {
  const expanded = expandWithDependencies(keys);
  for (const key of expanded) {
    if (!planAllowsBusinessCapability(planKey, key)) {
      const def = BUSINESS_CAPABILITY_REGISTRY[key];
      return {
        ok: false,
        message: `${def.label} requires a higher plan than ${resolvePlan(planKey).name}.`,
      };
    }
  }
  for (const key of expanded) {
    for (const conflict of BUSINESS_CAPABILITY_REGISTRY[key].conflicts ?? []) {
      if (expanded.includes(conflict)) {
        return {
          ok: false,
          message: `${BUSINESS_CAPABILITY_REGISTRY[key].label} conflicts with ${BUSINESS_CAPABILITY_REGISTRY[conflict].label}.`,
        };
      }
    }
  }
  return { ok: true, keys: expanded };
}

export function configurationFromIndustryPack(
  profile: IndustryProfile,
  planKey: PlanKey,
): OrganizationBusinessConfiguration {
  const desired = INDUSTRY_PACKS[profile];
  const allowed = desired.filter((key) => planAllowsBusinessCapability(planKey, key));
  const validated = validateBusinessCapabilitySet(allowed, planKey);
  return {
    industryProfile: profile,
    enabledCapabilities: validated.ok ? validated.keys : [],
    capabilitySettings: {},
    configurationVersion: BUSINESS_CAPABILITY_CONFIGURATION_VERSION,
  };
}

export function parseBusinessConfiguration(
  raw: string | undefined | null,
): OrganizationBusinessConfiguration {
  if (!raw) return { ...DEFAULT_BUSINESS_CONFIGURATION };
  try {
    const parsed = JSON.parse(raw) as Partial<OrganizationBusinessConfiguration>;
    const profile = isIndustryProfile(String(parsed.industryProfile ?? ""))
      ? (parsed.industryProfile as IndustryProfile)
      : DEFAULT_BUSINESS_CONFIGURATION.industryProfile;
    const enabled = Array.isArray(parsed.enabledCapabilities)
      ? parsed.enabledCapabilities.filter(
          (k): k is BusinessCapabilityKey => typeof k === "string" && isBusinessCapabilityKey(k),
        )
      : [];
    const settings =
      parsed.capabilitySettings && typeof parsed.capabilitySettings === "object"
        ? (parsed.capabilitySettings as Record<string, unknown>)
        : {};
    const version =
      typeof parsed.configurationVersion === "number" && parsed.configurationVersion >= 1
        ? parsed.configurationVersion
        : BUSINESS_CAPABILITY_CONFIGURATION_VERSION;
    return {
      industryProfile: profile,
      enabledCapabilities: enabled,
      capabilitySettings: settings,
      configurationVersion: version,
    };
  } catch {
    return { ...DEFAULT_BUSINESS_CONFIGURATION };
  }
}

export function assertBusinessCapabilityEnabled(
  config: OrganizationBusinessConfiguration | null | undefined,
  key: BusinessCapabilityKey,
): void {
  if (!hasBusinessCapability(config, key)) {
    throw new Error(
      `${BUSINESS_CAPABILITY_REGISTRY[key].label} is not enabled for this organization.`,
    );
  }
}
