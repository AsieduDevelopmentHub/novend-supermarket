import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireRole } from "./shared/permissions";
import { writeAuditLog } from "./shared/audit";
import { resolveLicense } from "./shared/entitlements";
import {
  BUSINESS_CAPABILITY_CONFIGURATION_VERSION,
  BUSINESS_CAPABILITY_KEYS,
  BUSINESS_CAPABILITY_REGISTRY,
  INDUSTRY_PROFILES,
  configurationFromIndustryPack,
  isBusinessCapabilityKey,
  parseBusinessConfiguration,
  validateBusinessCapabilitySet,
  DEFAULT_BUSINESS_CONFIGURATION,
  type IndustryProfile,
  type OrganizationBusinessConfiguration,
} from "./shared/businessCapabilities";
import {
  parseBusinessTerminologyOverrides,
  resolveBusinessTerms,
  sanitizeBusinessTerminologyOverrides,
  type BusinessTerminologyOverrides,
  type BusinessTermsMap,
} from "./shared/businessTerms";
import {
  PRODUCT_IMAGES_SETTINGS_KEY,
  parseProductImagesPolicy,
  type ProductImagesPolicy,
} from "./shared/productImagesPolicy";
import {
  EXPIRY_POLICY_SETTINGS_KEY,
  parseExpiryPolicy,
  clampExpiryAlertDays,
  isValidExpiryAlertDays,
  type ExpiryPolicy,
} from "./shared/expiryPolicy";
import {
  sanitizeEmail,
  sanitizeOptionalText,
  sanitizePhone,
  TEXT_LIMITS,
} from "./shared/validation";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getPlatformAdmin, getProfileByUserId } from "./shared/permissions";

export type BusinessProfile = {
  tradeName: string;
  legalName: string;
  /** Printed under org title when a branch sale is snapshotted; not stored in org settings. */
  branchName?: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
};

export type ReceiptTemplate = {
  paperWidthMm: 58 | 80;
  showLogo: boolean;
  headerText: string;
  footerText: string;
  thankYouLine: string;
  showCashier: boolean;
  showCustomer: boolean;
  showPaymentMethod: boolean;
  showAmountPaidAndChange: boolean;
  showSku: boolean;
};

export const DEFAULT_BUSINESS: BusinessProfile = {
  tradeName: "Novend",
  legalName: "Novend",
  address: "Accra, Ghana",
  phone: "",
  email: "",
  taxId: "",
};

export const DEFAULT_RECEIPT_TEMPLATE: ReceiptTemplate = {
  paperWidthMm: 80,
  showLogo: false,
  headerText: "Smart POS. Strong business.",
  footerText: "Thank you for your business",
  thankYouLine: "Goods sold are not returnable without receipt",
  showCashier: true,
  showCustomer: true,
  showPaymentMethod: true,
  showAmountPaidAndChange: true,
  showSku: false,
};

/** Chrome often autofills this field with the current page URL (localhost in dev). */
function cleanReceiptCopy(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(trimmed)) return fallback;
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") return fallback;
  } catch {
    /* not a URL */
  }
  return trimmed;
}

const BUSINESS_KEY = "business.profile";
const RECEIPT_KEY = "receipt.template";
const POS_KEY = "pos.preferences";
const CAPABILITIES_KEY = "business.capabilities";
const TERMINOLOGY_KEY = "business.terminology";

export type ReceiptPrintMode = "automatic" | "manual" | "never";

export type PosPreferences = {
  autoPrintReceipt: boolean;
  receiptPrintMode: ReceiptPrintMode;
};

export const DEFAULT_POS_PREFERENCES: PosPreferences = {
  autoPrintReceipt: false,
  receiptPrintMode: "manual",
};

function parsePosPreferences(raw: string | undefined): PosPreferences {
  if (!raw) return DEFAULT_POS_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as Partial<PosPreferences>;
    const receiptPrintMode: ReceiptPrintMode =
      parsed.receiptPrintMode === "automatic" ||
      parsed.receiptPrintMode === "manual" ||
      parsed.receiptPrintMode === "never"
        ? parsed.receiptPrintMode
        : parsed.autoPrintReceipt
          ? "automatic"
          : "manual";
    return {
      autoPrintReceipt: receiptPrintMode === "automatic",
      receiptPrintMode,
    };
  } catch {
    return DEFAULT_POS_PREFERENCES;
  }
}

type DbCtx = QueryCtx | MutationCtx;

async function getSettingValue(
  ctx: DbCtx,
  organizationId: import("./_generated/dataModel").Id<"organizations">,
  key: string,
) {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_organization_key", (q) => q.eq("organizationId", organizationId).eq("key", key))
    .unique();
  return row?.value;
}

async function upsertSetting(
  ctx: MutationCtx,
  organizationId: import("./_generated/dataModel").Id<"organizations">,
  key: string,
  value: string,
) {
  const existing = await ctx.db
    .query("settings")
    .withIndex("by_organization_key", (q) => q.eq("organizationId", organizationId).eq("key", key))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { value });
    return existing._id;
  }
  return await ctx.db.insert("settings", { organizationId, key, value });
}

function parseBusiness(raw: string | undefined): BusinessProfile {
  if (!raw) return DEFAULT_BUSINESS;
  try {
    return { ...DEFAULT_BUSINESS, ...(JSON.parse(raw) as Partial<BusinessProfile>) };
  } catch {
    return DEFAULT_BUSINESS;
  }
}

function parseTemplate(raw: string | undefined): ReceiptTemplate {
  if (!raw) return DEFAULT_RECEIPT_TEMPLATE;
  try {
    const parsed = JSON.parse(raw) as Partial<ReceiptTemplate>;
    return {
      ...DEFAULT_RECEIPT_TEMPLATE,
      ...parsed,
      headerText: cleanReceiptCopy(parsed.headerText, DEFAULT_RECEIPT_TEMPLATE.headerText),
      footerText: cleanReceiptCopy(parsed.footerText, DEFAULT_RECEIPT_TEMPLATE.footerText),
      thankYouLine: cleanReceiptCopy(parsed.thankYouLine, DEFAULT_RECEIPT_TEMPLATE.thankYouLine),
    };
  } catch {
    return DEFAULT_RECEIPT_TEMPLATE;
  }
}

/** Org-scoped business + receipt template used by sales, returns, and offline sync. */
export async function loadPrintSnapshot(
  ctx: DbCtx,
  organizationId: Id<"organizations">,
  branchId?: Id<"branches"> | null,
): Promise<{ business: BusinessProfile; template: ReceiptTemplate }> {
  const business = parseBusiness(await getSettingValue(ctx, organizationId, BUSINESS_KEY));
  const template = parseTemplate(await getSettingValue(ctx, organizationId, RECEIPT_KEY));

  if (branchId) {
    const branch = await ctx.db.get(branchId);
    if (branch) {
      const showName = branch.receiptShowName ?? true;
      const showAddress = branch.receiptShowAddress ?? true;
      const showPhone = branch.receiptShowPhone ?? true;
      const showEmail = branch.receiptShowEmail ?? true;
      return {
        business: {
          ...business,
          branchName: showName ? branch.name : undefined,
          address: showAddress ? (branch.address ?? "") : "",
          phone: showPhone ? (branch.phone ?? "") : "",
          email: showEmail ? (branch.email ?? "") : "",
        },
        template:
          branch.receiptPaperWidthMm === 58 || branch.receiptPaperWidthMm === 80
            ? { ...template, paperWidthMm: branch.receiptPaperWidthMm }
            : template,
      };
    }
  }

  return { business, template };
}

/** Org capability configuration for offline mirror and Convex gates. */
export async function loadBusinessConfiguration(
  ctx: DbCtx,
  organizationId: Id<"organizations">,
): Promise<OrganizationBusinessConfiguration> {
  return parseBusinessConfiguration(await getSettingValue(ctx, organizationId, CAPABILITIES_KEY));
}

/** Admin terminology overrides (partial). */
export async function loadBusinessTerminologyOverrides(
  ctx: DbCtx,
  organizationId: Id<"organizations">,
): Promise<BusinessTerminologyOverrides> {
  return parseBusinessTerminologyOverrides(
    await getSettingValue(ctx, organizationId, TERMINOLOGY_KEY),
  );
}

/** Resolved terms for offline snapshot (industry defaults + overrides). */
export async function loadResolvedBusinessTerms(
  ctx: DbCtx,
  organizationId: Id<"organizations">,
  industryProfile?: IndustryProfile | string | null,
): Promise<{
  industryProfile: IndustryProfile | string;
  overrides: BusinessTerminologyOverrides;
  terms: BusinessTermsMap;
}> {
  const config =
    industryProfile != null
      ? null
      : await loadBusinessConfiguration(ctx, organizationId);
  const profile = industryProfile ?? config?.industryProfile ?? "retail";
  const overrides = await loadBusinessTerminologyOverrides(ctx, organizationId);
  return {
    industryProfile: profile,
    overrides,
    terms: resolveBusinessTerms(profile, overrides),
  };
}

/** Product-image upload policy for Convex gates and offline snapshot. */
export async function loadProductImagesPolicy(
  ctx: DbCtx,
  organizationId: Id<"organizations">,
): Promise<ProductImagesPolicy> {
  return parseProductImagesPolicy(
    await getSettingValue(ctx, organizationId, PRODUCT_IMAGES_SETTINGS_KEY),
  );
}

/** Persist product-image policy (org admin or platform). */
export async function writeProductImagesPolicy(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  enabled: boolean,
): Promise<ProductImagesPolicy> {
  const policy: ProductImagesPolicy = { enabled };
  await upsertSetting(ctx, organizationId, PRODUCT_IMAGES_SETTINGS_KEY, JSON.stringify(policy));
  return policy;
}

/** Org default expiry alert window for Convex list/dashboard + offline snapshot. */
export async function loadExpiryPolicy(
  ctx: DbCtx,
  organizationId: Id<"organizations">,
): Promise<ExpiryPolicy> {
  return parseExpiryPolicy(await getSettingValue(ctx, organizationId, EXPIRY_POLICY_SETTINGS_KEY));
}

/** Persist org expiry alert default (administrator). */
export async function writeExpiryPolicy(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  defaultAlertDays: number,
): Promise<ExpiryPolicy> {
  if (!isValidExpiryAlertDays(defaultAlertDays)) {
    throw new Error("Expiry alert days must be between 0 and 3650");
  }
  const policy: ExpiryPolicy = { defaultAlertDays: clampExpiryAlertDays(defaultAlertDays) };
  await upsertSetting(ctx, organizationId, EXPIRY_POLICY_SETTINGS_KEY, JSON.stringify(policy));
  return policy;
}

export const getBusiness = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    return parseBusiness(await getSettingValue(ctx, organizationId, BUSINESS_KEY));
  },
});

export const getReceiptTemplate = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager", "cashier"]);
    return parseTemplate(await getSettingValue(ctx, organizationId, RECEIPT_KEY));
  },
});

export const getPrintBundle = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager", "cashier"]);
    return {
      business: parseBusiness(await getSettingValue(ctx, organizationId, BUSINESS_KEY)),
      template: parseTemplate(await getSettingValue(ctx, organizationId, RECEIPT_KEY)),
      pos: parsePosPreferences(await getSettingValue(ctx, organizationId, POS_KEY)),
    };
  },
});

export const getPosPreferences = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager", "cashier"]);
    return parsePosPreferences(await getSettingValue(ctx, organizationId, POS_KEY));
  },
});

export const updatePosPreferences = mutation({
  args: {
    autoPrintReceipt: v.optional(v.boolean()),
    receiptPrintMode: v.optional(
      v.union(v.literal("automatic"), v.literal("manual"), v.literal("never")),
    ),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const receiptPrintMode: ReceiptPrintMode =
      args.receiptPrintMode ?? (args.autoPrintReceipt ? "automatic" : "manual");
    const prefs: PosPreferences = {
      autoPrintReceipt: receiptPrintMode === "automatic",
      receiptPrintMode,
    };
    await upsertSetting(ctx, organizationId, POS_KEY, JSON.stringify(prefs));
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "update_pos_preferences",
      entityType: "settings",
      entityId: POS_KEY,
    });
    return prefs;
  },
});

export const updateBusiness = mutation({
  args: {
    tradeName: v.string(),
    legalName: v.string(),
    address: v.string(),
    phone: v.string(),
    email: v.string(),
    taxId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, ["administrator"]);
    const profile: BusinessProfile = {
      tradeName:
        sanitizeOptionalText(args.tradeName, "Trade name", TEXT_LIMITS.name) ||
        DEFAULT_BUSINESS.tradeName,
      legalName: sanitizeOptionalText(args.legalName, "Legal name", TEXT_LIMITS.name) ?? "",
      address: sanitizeOptionalText(args.address, "Address", TEXT_LIMITS.address) ?? "",
      phone: sanitizePhone(args.phone) ?? "",
      email: sanitizeEmail(args.email) ?? "",
      taxId: sanitizeOptionalText(args.taxId, "Tax ID", TEXT_LIMITS.short) ?? "",
    };
    await upsertSetting(ctx, organizationId, BUSINESS_KEY, JSON.stringify(profile));
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "update_business_profile",
      entityType: "settings",
      entityId: BUSINESS_KEY,
    });
    return profile;
  },
});

export const updateReceiptTemplate = mutation({
  args: {
    paperWidthMm: v.union(v.literal(58), v.literal(80)),
    showLogo: v.boolean(),
    headerText: v.string(),
    footerText: v.string(),
    thankYouLine: v.string(),
    showCashier: v.boolean(),
    showCustomer: v.boolean(),
    showPaymentMethod: v.boolean(),
    showAmountPaidAndChange: v.boolean(),
    showSku: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, ["administrator"]);
    const template: ReceiptTemplate = {
      paperWidthMm: args.paperWidthMm,
      showLogo: false,
      headerText: cleanReceiptCopy(
        sanitizeOptionalText(args.headerText, "Header text", TEXT_LIMITS.note),
        "",
      ),
      footerText: sanitizeOptionalText(args.footerText, "Footer text", TEXT_LIMITS.note) ?? "",
      thankYouLine:
        sanitizeOptionalText(args.thankYouLine, "Thank-you line", TEXT_LIMITS.short) ?? "",
      showCashier: args.showCashier,
      showCustomer: args.showCustomer,
      showPaymentMethod: args.showPaymentMethod,
      showAmountPaidAndChange: args.showAmountPaidAndChange,
      showSku: args.showSku,
    };
    await upsertSetting(ctx, organizationId, RECEIPT_KEY, JSON.stringify(template));
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "update_receipt_template",
      entityType: "settings",
      entityId: RECEIPT_KEY,
    });
    return template;
  },
});

export const getBusinessCapabilities = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    // Platform-only Super Admins have no tenant profile. OfflineOutlet still
    // mounts this hook under /platform — return defaults instead of Forbidden.
    const profile = await getProfileByUserId(ctx, userId);
    if (!profile || profile.status !== "active") {
      const platformAdmin = await getPlatformAdmin(ctx, userId);
      if (platformAdmin) return { ...DEFAULT_BUSINESS_CONFIGURATION };
      throw new Error("Forbidden");
    }

    return loadBusinessConfiguration(ctx, profile.organizationId);
  },
});

export const getBusinessCapabilityCatalog = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["administrator"]);
    return {
      profiles: INDUSTRY_PROFILES,
      capabilities: BUSINESS_CAPABILITY_KEYS.map((key) => BUSINESS_CAPABILITY_REGISTRY[key]),
      configurationVersion: BUSINESS_CAPABILITY_CONFIGURATION_VERSION,
    };
  },
});

export const updateBusinessCapabilities = mutation({
  args: {
    industryProfile: v.string(),
    enabledCapabilities: v.array(v.string()),
    /**
     * When true, ignore `enabledCapabilities` and load the industry pack
     * (plan-filtered). Does NOT reset brand / experienceOverrides — branding
     * is only seeded at org provision.
     */
    applyIndustryPack: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, ["administrator"]);
    const organization = await ctx.db.get(organizationId);
    if (!organization) throw new Error("Organization not found");
    const license = await resolveLicense(ctx, organization);

    // Milliesmart is supermarket-only — ignore any other profile from the client.
    const profile: IndustryProfile = "supermarket";

    let next: OrganizationBusinessConfiguration;
    if (args.applyIndustryPack) {
      next = configurationFromIndustryPack(profile, license.planKey);
    } else {
      const keys = args.enabledCapabilities.filter(isBusinessCapabilityKey);
      const validated = validateBusinessCapabilitySet(keys, license.planKey);
      if (!validated.ok) throw new Error(validated.message);
      next = {
        industryProfile: profile,
        enabledCapabilities: validated.keys,
        capabilitySettings: {},
        configurationVersion: BUSINESS_CAPABILITY_CONFIGURATION_VERSION,
      };
    }

    await upsertSetting(ctx, organizationId, CAPABILITIES_KEY, JSON.stringify(next));

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "update_business_capabilities",
      entityType: "settings",
      entityId: CAPABILITIES_KEY,
      metadata: {
        industryProfile: next.industryProfile,
        enabledCapabilities: next.enabledCapabilities,
        configurationVersion: next.configurationVersion,
      },
    });
    return next;
  },
});

export const getBusinessTerminology = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const profile = await getProfileByUserId(ctx, userId);
    if (!profile || profile.status !== "active") {
      const platformAdmin = await getPlatformAdmin(ctx, userId);
      if (platformAdmin) return {} as BusinessTerminologyOverrides;
      throw new Error("Forbidden");
    }

    return loadBusinessTerminologyOverrides(ctx, profile.organizationId);
  },
});

export const updateBusinessTerminology = mutation({
  args: {
    overrides: v.record(v.string(), v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, ["administrator"]);
    const cleaned = sanitizeBusinessTerminologyOverrides(args.overrides);
    await upsertSetting(ctx, organizationId, TERMINOLOGY_KEY, JSON.stringify(cleaned));
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "update_business_terminology",
      entityType: "settings",
      entityId: TERMINOLOGY_KEY,
      metadata: { keys: Object.keys(cleaned) },
    });
    return cleaned;
  },
});

export const getProductImages = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager", "cashier"]);
    return loadProductImagesPolicy(ctx, organizationId);
  },
});

export const updateProductImages = mutation({
  args: {
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, ["administrator"]);
    const previous = await loadProductImagesPolicy(ctx, organizationId);
    const policy = await writeProductImagesPolicy(ctx, organizationId, args.enabled);
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "update_product_images_policy",
      entityType: "settings",
      entityId: PRODUCT_IMAGES_SETTINGS_KEY,
      metadata: { enabled: policy.enabled, previousEnabled: previous.enabled },
    });
    return policy;
  },
});

export const getExpiryPolicy = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager", "cashier"]);
    return loadExpiryPolicy(ctx, organizationId);
  },
});

export const updateExpiryPolicy = mutation({
  args: {
    defaultAlertDays: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, ["administrator"]);
    const previous = await loadExpiryPolicy(ctx, organizationId);
    const policy = await writeExpiryPolicy(ctx, organizationId, args.defaultAlertDays);
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "update_expiry_policy",
      entityType: "settings",
      entityId: EXPIRY_POLICY_SETTINGS_KEY,
      metadata: {
        defaultAlertDays: policy.defaultAlertDays,
        previousDefaultAlertDays: previous.defaultAlertDays,
      },
    });
    return policy;
  },
});
