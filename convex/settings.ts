import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { requireRole } from "./shared/permissions";
import { writeAuditLog } from "./shared/audit";
import {
  sanitizeEmail,
  sanitizeOptionalText,
  sanitizePhone,
  TEXT_LIMITS,
} from "./shared/validation";

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
  headerText: "Wholesale & Retail Distribution",
  footerText: "Thank you for your business",
  thankYouLine: "Goods sold are not returnable without receipt",
  showCashier: true,
  showCustomer: true,
  showPaymentMethod: true,
  showSku: false,
};

const BUSINESS_KEY = "business.profile";
const RECEIPT_KEY = "receipt.template";
const POS_KEY = "pos.preferences";

export type PosPreferences = {
  autoPrintReceipt: boolean;
};

export const DEFAULT_POS_PREFERENCES: PosPreferences = {
  autoPrintReceipt: false,
};

function parsePosPreferences(raw: string | undefined): PosPreferences {
  if (!raw) return DEFAULT_POS_PREFERENCES;
  try {
    return { ...DEFAULT_POS_PREFERENCES, ...(JSON.parse(raw) as Partial<PosPreferences>) };
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
    .withIndex("by_organization_key", (q) =>
      q.eq("organizationId", organizationId).eq("key", key),
    )
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
    .withIndex("by_organization_key", (q) =>
      q.eq("organizationId", organizationId).eq("key", key),
    )
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
    return {
      ...DEFAULT_RECEIPT_TEMPLATE,
      ...(JSON.parse(raw) as Partial<ReceiptTemplate>),
    };
  } catch {
    return DEFAULT_RECEIPT_TEMPLATE;
  }
}

export const getBusiness = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    return parseBusiness(await getSettingValue(ctx, organizationId, BUSINESS_KEY));
  },
});

export const getReceiptTemplate = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    return parseTemplate(await getSettingValue(ctx, organizationId, RECEIPT_KEY));
  },
});

export const getPrintBundle = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
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
  args: { autoPrintReceipt: v.boolean() },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const prefs: PosPreferences = { autoPrintReceipt: args.autoPrintReceipt };
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
    showSku: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, ["administrator"]);
    const template: ReceiptTemplate = {
      paperWidthMm: args.paperWidthMm,
      showLogo: false,
      headerText: sanitizeOptionalText(args.headerText, "Header text", TEXT_LIMITS.note) ?? "",
      footerText: sanitizeOptionalText(args.footerText, "Footer text", TEXT_LIMITS.note) ?? "",
      thankYouLine:
        sanitizeOptionalText(args.thankYouLine, "Thank-you line", TEXT_LIMITS.short) ?? "",
      showCashier: args.showCashier,
      showCustomer: args.showCustomer,
      showPaymentMethod: args.showPaymentMethod,
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


