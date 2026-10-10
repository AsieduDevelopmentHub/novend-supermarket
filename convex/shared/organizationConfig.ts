/**
 * Central organization configuration resolver.
 *
 * Precedence for each feature (highest wins):
 * 1. Explicit organization override (enabled / disabled; inherit skips)
 * 2. Organization feature template
 * 3. Private commercial offer feature override
 * 4. Plan-derived capability mapping
 * 5. Secure registry default
 *
 * Platform org flags `cloudBackupEnabled` / `remoteMonitoringEnabled` act as
 * safety clamps after resolution. Prerequisites disabled higher in the tree
 * force dependents off.
 */

import type { Id } from "../_generated/dataModel";
import { planCapabilities } from "./capabilities";
import {
  DEFAULT_NOVEND_EXPERIENCE,
  type ExperienceRadiusScale,
  type ResolvedExperienceTokens,
  validateHexColor,
} from "./experience";
import {
  FEATURE_KEYS,
  FEATURE_REGISTRY,
  type FeatureKey,
  isFeatureKey,
} from "./features";
import {
  resolvePlan,
  type PlanKey,
  type SellablePlanKey,
} from "./plans";

export type BillingVisibility = "visible" | "hidden" | "custom_offer_only";

export type FeatureOverrideValue = "inherit" | "enabled" | "disabled";

export type OrganizationFeatureOverride = {
  feature: FeatureKey;
  value: FeatureOverrideValue;
};

export type FeatureTemplateValue = {
  feature: FeatureKey;
  enabled: boolean;
};

export type ExperienceOverridesInput = {
  accent?: string;
  accentForeground?: string;
  sidebarBackground?: string;
  sidebarForeground?: string;
  sidebarAccent?: string;
  sidebarAccentForeground?: string;
};

export type ExperiencePresetInput = {
  accent: string;
  accentForeground: string;
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  focusRing: string;
  success: string;
  warning: string;
  danger: string;
  radiusScale: ExperienceRadiusScale;
};

export type FeatureTemplateInput = {
  values: FeatureTemplateValue[];
};

export type CommercialOfferInput = {
  _id: Id<"commercialOffers">;
  basePlanKey?: SellablePlanKey;
  featureOverrides?: FeatureTemplateValue[];
  status?: string;
};

export type OrganizationConfigInput = {
  _id: Id<"organizations">;
  experienceOverrides?: ExperienceOverridesInput | null;
  experienceVersion?: number;
  featureOverrides?: OrganizationFeatureOverride[] | null;
  featureEntitlementVersion?: number;
  billingVisibility?: BillingVisibility | null;
  entitlementVersion?: number;
  cloudBackupEnabled?: boolean;
  remoteMonitoringEnabled?: boolean;
};

export type ResolvedOrganizationConfig = {
  organizationId: Id<"organizations">;
  version: number;
  experience: ResolvedExperienceTokens;
  features: Record<FeatureKey, boolean>;
  billingVisibility: BillingVisibility;
  commercial: {
    /** Resolved catalog key, including historical `lifetime`. */
    planKey: PlanKey;
    offerId?: Id<"commercialOffers">;
    canSelfServe: boolean;
  };
};

function applyHexOverride(
  base: string,
  override: string | undefined,
): string {
  if (override === undefined) return base;
  const validated = validateHexColor(override);
  return validated.ok ? validated.value : base;
}

export function resolveExperienceTokens(
  preset: ExperiencePresetInput | null | undefined,
  overrides: ExperienceOverridesInput | null | undefined,
): ResolvedExperienceTokens {
  const base: ResolvedExperienceTokens = preset
    ? {
        accent: preset.accent,
        accentForeground: preset.accentForeground,
        sidebarBackground: preset.sidebarBackground,
        sidebarForeground: preset.sidebarForeground,
        sidebarAccent: preset.sidebarAccent,
        sidebarAccentForeground: preset.sidebarAccentForeground,
        focusRing: preset.focusRing,
        success: preset.success,
        warning: preset.warning,
        danger: preset.danger,
        radiusScale: preset.radiusScale,
      }
    : { ...DEFAULT_NOVEND_EXPERIENCE };

  if (!overrides) return base;

  const accent = applyHexOverride(base.accent, overrides.accent);
  // Org overrides only expose accent today — keep focus chrome in sync with the
  // brand accent so login rings/atmosphere never stay on default Candy Blue.
  const focusRing = overrides.accent !== undefined ? accent : base.focusRing;

  return {
    ...base,
    accent,
    accentForeground: applyHexOverride(base.accentForeground, overrides.accentForeground),
    sidebarBackground: applyHexOverride(base.sidebarBackground, overrides.sidebarBackground),
    sidebarForeground: applyHexOverride(base.sidebarForeground, overrides.sidebarForeground),
    sidebarAccent: applyHexOverride(base.sidebarAccent, overrides.sidebarAccent),
    sidebarAccentForeground: applyHexOverride(
      base.sidebarAccentForeground,
      overrides.sidebarAccentForeground,
    ),
    focusRing,
  };
}

/**
 * Maps planCapabilities (+ plan limits / selfServe) onto FEATURE_KEYS.
 * Unknown plans fall through resolvePlan → DEFAULT_PLAN_KEY (basic).
 */
export function featuresFromPlan(planKey: unknown): Record<FeatureKey, boolean> {
  const plan = resolvePlan(planKey);
  const caps = planCapabilities(plan.key);
  const advanced = caps.canAdvancedAnalytics;
  const multiBranch = plan.limits.branches === null || plan.limits.branches > 1;

  const mapped: Record<FeatureKey, boolean> = {
    "billing.view": FEATURE_REGISTRY["billing.view"].defaultEnabled,
    "billing.selfServeCheckout": plan.selfServe,
    "products.images": FEATURE_REGISTRY["products.images"].defaultEnabled,
    "products.editStock": FEATURE_REGISTRY["products.editStock"].defaultEnabled,
    "inventory.wholesale": advanced,
    "branches.multiBranch": multiBranch,
    "reports.advanced": caps.canAdvancedAnalytics,
    "reports.pdf": caps.canExportPdf,
    "reports.xlsx": caps.canExportXlsx,
    "staff.compensation": caps.canManageStaffCompensation,
    customerDisplay: caps.canUseCustomerDisplay,
    "cloud.backup": FEATURE_REGISTRY["cloud.backup"].defaultEnabled,
    "cloud.remoteMonitoring": FEATURE_REGISTRY["cloud.remoteMonitoring"].defaultEnabled,
    "imports.products": caps.canImportProducts,
    "exports.reports": caps.canExportReports,
    "sms.notifications": caps.canSmsNotifications,
    "sms.staff": caps.canSmsStaff,
    "sms.customers": caps.canSmsCustomers,
    "sms.salaryAlerts": caps.canSmsSalaryAlerts,
    "sms.orgConfig": caps.canSmsOrgConfig,
  };

  return mapped;
}

function applyTemplateOrOffer(
  current: Record<FeatureKey, boolean>,
  values: FeatureTemplateValue[] | null | undefined,
): Record<FeatureKey, boolean> {
  if (!values || values.length === 0) return current;
  const next = { ...current };
  for (const entry of values) {
    if (!isFeatureKey(entry.feature)) continue;
    next[entry.feature] = entry.enabled;
  }
  return next;
}

function applyOrganizationOverrides(
  current: Record<FeatureKey, boolean>,
  overrides: OrganizationFeatureOverride[] | null | undefined,
): Record<FeatureKey, boolean> {
  if (!overrides || overrides.length === 0) return current;
  const next = { ...current };
  for (const entry of overrides) {
    if (!isFeatureKey(entry.feature)) continue;
    if (entry.value === "inherit") continue;
    next[entry.feature] = entry.value === "enabled";
  }
  return next;
}

/** Disable any feature whose prerequisites are off. Fixed-point over the set. */
export function enforceFeaturePrerequisites(
  features: Record<FeatureKey, boolean>,
): Record<FeatureKey, boolean> {
  const next = { ...features };
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of FEATURE_KEYS) {
      if (!next[key]) continue;
      const prereqs = FEATURE_REGISTRY[key].prerequisites;
      if (prereqs.some((p) => !next[p])) {
        next[key] = false;
        changed = true;
      }
    }
  }
  return next;
}

function resolveBillingVisibility(
  org: OrganizationConfigInput,
  offer: CommercialOfferInput | null | undefined,
): BillingVisibility {
  if (org.billingVisibility) return org.billingVisibility;
  if (offer && (offer.status === "active" || offer.status === "accepted")) {
    return "custom_offer_only";
  }
  return "visible";
}

function configVersion(org: OrganizationConfigInput): number {
  return Math.max(
    org.entitlementVersion ?? 0,
    org.experienceVersion ?? 0,
    org.featureEntitlementVersion ?? 0,
  );
}

/**
 * Pure resolver — pass already-loaded preset / template / offer documents.
 * Does not touch the database.
 */
export function resolveOrganizationConfig(args: {
  organization: OrganizationConfigInput;
  planKey: unknown;
  preset?: ExperiencePresetInput | null;
  template?: FeatureTemplateInput | null;
  offer?: CommercialOfferInput | null;
}): ResolvedOrganizationConfig {
  const { organization: org, preset, template, offer } = args;
  const plan = resolvePlan(args.planKey);

  let features = featuresFromPlan(plan.key);
  features = applyTemplateOrOffer(features, offer?.featureOverrides);
  features = applyTemplateOrOffer(features, template?.values);
  features = applyOrganizationOverrides(features, org.featureOverrides);

  if (org.cloudBackupEnabled === false) {
    features["cloud.backup"] = false;
  }
  if (org.remoteMonitoringEnabled === false) {
    features["cloud.remoteMonitoring"] = false;
  }

  const billingVisibility = resolveBillingVisibility(org, offer);
  if (billingVisibility === "hidden") {
    features["billing.view"] = false;
    features["billing.selfServeCheckout"] = false;
  }

  features = enforceFeaturePrerequisites(features);

  const experience = resolveExperienceTokens(preset, org.experienceOverrides);

  const canSelfServe =
    features["billing.selfServeCheckout"] &&
    billingVisibility !== "hidden" &&
    plan.selfServe;

  return {
    organizationId: org._id,
    version: configVersion(org),
    experience,
    features,
    billingVisibility,
    commercial: {
      planKey: plan.key,
      offerId: offer?._id,
      canSelfServe,
    },
  };
}

export type FeatureEffectiveSource =
  | "organization_override"
  | "feature_template"
  | "commercial_offer"
  | "plan"
  | "platform_clamp"
  | "billing_visibility"
  | "prerequisite"
  | "default";

/**
 * Explains which layer produced the effective boolean for a single feature.
 * Mirrors resolveOrganizationConfig precedence for platform admin UI.
 */
export function resolveFeatureEffectiveSource(args: {
  feature: FeatureKey;
  organization: OrganizationConfigInput;
  planKey: unknown;
  template?: FeatureTemplateInput | null;
  offer?: CommercialOfferInput | null;
  effective: boolean;
}): FeatureEffectiveSource {
  const { feature, organization: org, template, offer } = args;
  const planFeatures = featuresFromPlan(args.planKey);

  const orgOverride = org.featureOverrides?.find((row) => row.feature === feature);
  if (orgOverride && orgOverride.value !== "inherit") {
    return "organization_override";
  }

  if (feature === "cloud.backup" && org.cloudBackupEnabled === false) {
    return "platform_clamp";
  }
  if (feature === "cloud.remoteMonitoring" && org.remoteMonitoringEnabled === false) {
    return "platform_clamp";
  }

  const billingVisibility = resolveBillingVisibility(org, offer);
  if (
    billingVisibility === "hidden" &&
    (feature === "billing.view" || feature === "billing.selfServeCheckout")
  ) {
    return "billing_visibility";
  }

  const templateEntry = template?.values.find((row) => row.feature === feature);
  if (templateEntry) {
    return "feature_template";
  }

  const offerEntry = offer?.featureOverrides?.find((row) => row.feature === feature);
  if (offerEntry) {
    return "commercial_offer";
  }

  if (planFeatures[feature] !== FEATURE_REGISTRY[feature].defaultEnabled) {
    return "plan";
  }

  if (args.effective !== FEATURE_REGISTRY[feature].defaultEnabled) {
    return "prerequisite";
  }

  return "default";
}

export function featureSourceLabel(
  source: FeatureEffectiveSource,
  extras?: { planName?: string; templateName?: string },
): string {
  switch (source) {
    case "organization_override":
      return "Organization override";
    case "feature_template":
      return extras?.templateName
        ? `Enabled by ${extras.templateName} template`
        : "Feature template";
    case "commercial_offer":
      return "Commercial offer";
    case "plan":
      return extras?.planName ? `From ${extras.planName} plan` : "Plan entitlement";
    case "platform_clamp":
      return "Platform safety clamp";
    case "billing_visibility":
      return "Billing visibility";
    case "prerequisite":
      return "Disabled by prerequisite";
    default:
      return "Secure default";
  }
}
