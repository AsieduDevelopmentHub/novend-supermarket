/**
 * Private commercial offers — platform admin CRUD + tenant read/accept.
 *
 * Tenant APIs never accept organizationId from the client and never return
 * notesInternal or gateway plan codes.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { limitOverridesValidator, sellablePlanKeyValidator } from "./schema";
import { featureKeyValidator, isFeatureKey, type FeatureKey } from "./shared/features";
import { requirePlatformAdmin, requireSessionIgnoringLicense } from "./shared/permissions";
import { writeAuditLog } from "./shared/audit";
import {
  assertPositiveMoney,
  roundMoney,
  sanitizeOptionalText,
  sanitizeText,
  TEXT_LIMITS,
} from "./shared/validation";
import { bumpEntitlementVersion } from "./shared/entitlementVersion";
import {
  isCommercialOfferLive,
  loadLiveOfferForOrganization,
  toTenantCommercialOffer,
  type TenantCommercialOffer,
} from "./shared/commercialOffers";

const billingCycleOfferValidator = v.union(v.literal("monthly"), v.literal("yearly"));

function normalizeOfferFeatureOverrides(
  values: Array<{ feature: string; enabled: boolean }> | undefined,
) {
  if (!values) return undefined;
  const seen = new Set<string>();
  const normalized: Array<{ feature: FeatureKey; enabled: boolean }> = [];
  for (const entry of values) {
    if (!isFeatureKey(entry.feature)) {
      throw new Error(`Unknown feature key: ${entry.feature}`);
    }
    if (seen.has(entry.feature)) {
      throw new Error(`Duplicate feature override: ${entry.feature}`);
    }
    seen.add(entry.feature);
    normalized.push({ feature: entry.feature, enabled: entry.enabled });
  }
  return normalized.length > 0 ? normalized : undefined;
}

function normalizePrices(args: {
  monthlyPrice?: number;
  yearlyPrice?: number;
  allowedCycles: Array<"monthly" | "yearly">;
}) {
  if (args.allowedCycles.length === 0) {
    throw new Error("At least one billing cycle must be allowed.");
  }
  const unique = [...new Set(args.allowedCycles)];
  if (unique.length !== args.allowedCycles.length) {
    throw new Error("Duplicate billing cycles are not allowed.");
  }

  let monthlyPrice = args.monthlyPrice;
  let yearlyPrice = args.yearlyPrice;

  if (monthlyPrice !== undefined) {
    assertPositiveMoney(monthlyPrice, "monthly price");
    monthlyPrice = roundMoney(monthlyPrice);
  }
  if (yearlyPrice !== undefined) {
    assertPositiveMoney(yearlyPrice, "yearly price");
    yearlyPrice = roundMoney(yearlyPrice);
  }

  if (unique.includes("monthly") && monthlyPrice === undefined) {
    throw new Error("Monthly price is required when monthly cycle is allowed.");
  }
  if (unique.includes("yearly") && yearlyPrice === undefined) {
    throw new Error("Yearly price is required when yearly cycle is allowed.");
  }

  return { allowedCycles: unique, monthlyPrice, yearlyPrice };
}

// ─── Platform administrator ─────────────────────────────────────────────────

/** Platform: list all offers for an organization (includes notesInternal). */
export const listForOrganization = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) return [];
    const rows = await ctx.db
      .query("commercialOffers")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const get = query({
  args: { offerId: v.id("commercialOffers") },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    return await ctx.db.get(args.offerId);
  },
});

export const createDraft = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    basePlanKey: sellablePlanKeyValidator,
    currency: v.optional(v.string()),
    monthlyPrice: v.optional(v.number()),
    yearlyPrice: v.optional(v.number()),
    allowedCycles: v.array(billingCycleOfferValidator),
    limitOverrides: v.optional(limitOverridesValidator),
    featureOverrides: v.optional(
      v.array(
        v.object({
          feature: featureKeyValidator,
          enabled: v.boolean(),
        }),
      ),
    ),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    notesInternal: v.optional(v.string()),
    customerMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found.");

    const name = sanitizeText(args.name, "Offer name", TEXT_LIMITS.name);
    const currency = (args.currency?.trim().toUpperCase() || org.currency).slice(0, 8);
    const prices = normalizePrices({
      monthlyPrice: args.monthlyPrice,
      yearlyPrice: args.yearlyPrice,
      allowedCycles: args.allowedCycles,
    });
    const featureOverrides = normalizeOfferFeatureOverrides(args.featureOverrides);
    const notesInternal = sanitizeOptionalText(
      args.notesInternal,
      "Internal notes",
      TEXT_LIMITS.description,
    );
    const customerMessage = sanitizeOptionalText(
      args.customerMessage,
      "Customer message",
      TEXT_LIMITS.description,
    );
    const validFrom = args.validFrom ?? Date.now();
    if (args.validUntil !== undefined && args.validUntil <= validFrom) {
      throw new Error("validUntil must be after validFrom.");
    }

    const now = Date.now();
    const id = await ctx.db.insert("commercialOffers", {
      organizationId: args.organizationId,
      name,
      status: "draft",
      basePlanKey: args.basePlanKey,
      currency,
      monthlyPrice: prices.monthlyPrice,
      yearlyPrice: prices.yearlyPrice,
      allowedCycles: prices.allowedCycles,
      limitOverrides: args.limitOverrides,
      featureOverrides,
      validFrom,
      validUntil: args.validUntil,
      notesInternal,
      customerMessage,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      organizationId: args.organizationId,
      action: "platform_commercial_offer_create",
      entityType: "commercialOffers",
      entityId: id,
      metadata: {
        name,
        basePlanKey: args.basePlanKey,
        status: "draft",
      },
    });

    return id;
  },
});

export const update = mutation({
  args: {
    offerId: v.id("commercialOffers"),
    name: v.optional(v.string()),
    basePlanKey: v.optional(sellablePlanKeyValidator),
    monthlyPrice: v.optional(v.number()),
    yearlyPrice: v.optional(v.number()),
    allowedCycles: v.optional(v.array(billingCycleOfferValidator)),
    limitOverrides: v.optional(v.union(v.null(), limitOverridesValidator)),
    featureOverrides: v.optional(
      v.union(
        v.null(),
        v.array(
          v.object({
            feature: featureKeyValidator,
            enabled: v.boolean(),
          }),
        ),
      ),
    ),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.union(v.number(), v.null())),
    notesInternal: v.optional(v.union(v.string(), v.null())),
    customerMessage: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new Error("Commercial offer not found.");
    if (offer.status === "accepted" || offer.status === "withdrawn" || offer.status === "expired") {
      throw new Error(
        `Cannot edit an offer in "${offer.status}" status. Create a new revision instead.`,
      );
    }

    const allowedCycles = args.allowedCycles ?? offer.allowedCycles;
    const prices = normalizePrices({
      monthlyPrice:
        args.monthlyPrice !== undefined ? args.monthlyPrice : offer.monthlyPrice,
      yearlyPrice: args.yearlyPrice !== undefined ? args.yearlyPrice : offer.yearlyPrice,
      allowedCycles,
    });

    const validFrom = args.validFrom ?? offer.validFrom;
    const validUntil =
      args.validUntil === null
        ? undefined
        : args.validUntil !== undefined
          ? args.validUntil
          : offer.validUntil;
    if (validUntil !== undefined && validUntil <= validFrom) {
      throw new Error("validUntil must be after validFrom.");
    }

    const patch: Record<string, unknown> = {
      updatedAt: Date.now(),
      monthlyPrice: prices.monthlyPrice,
      yearlyPrice: prices.yearlyPrice,
      allowedCycles: prices.allowedCycles,
      validFrom,
      validUntil,
    };

    if (args.name !== undefined) {
      patch.name = sanitizeText(args.name, "Offer name", TEXT_LIMITS.name);
    }
    if (args.basePlanKey !== undefined) {
      patch.basePlanKey = args.basePlanKey;
    }
    if (args.limitOverrides !== undefined) {
      patch.limitOverrides = args.limitOverrides === null ? undefined : args.limitOverrides;
    }
    if (args.featureOverrides !== undefined) {
      patch.featureOverrides =
        args.featureOverrides === null
          ? undefined
          : normalizeOfferFeatureOverrides(args.featureOverrides);
    }
    if (args.notesInternal !== undefined) {
      patch.notesInternal =
        args.notesInternal === null
          ? undefined
          : sanitizeOptionalText(args.notesInternal, "Internal notes", TEXT_LIMITS.description);
    }
    if (args.customerMessage !== undefined) {
      patch.customerMessage =
        args.customerMessage === null
          ? undefined
          : sanitizeOptionalText(
              args.customerMessage,
              "Customer message",
              TEXT_LIMITS.description,
            );
    }

    await ctx.db.patch(args.offerId, patch);

    if (offer.status === "active") {
      await bumpEntitlementVersion(ctx, offer.organizationId);
    }

    await writeAuditLog(ctx, {
      actorId: userId,
      organizationId: offer.organizationId,
      action: "platform_commercial_offer_update",
      entityType: "commercialOffers",
      entityId: args.offerId,
      metadata: { status: offer.status, name: patch.name ?? offer.name },
    });

    return args.offerId;
  },
});

export const activate = mutation({
  args: { offerId: v.id("commercialOffers") },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new Error("Commercial offer not found.");
    if (offer.status !== "draft" && offer.status !== "withdrawn") {
      throw new Error(`Cannot activate an offer in "${offer.status}" status.`);
    }

    normalizePrices({
      monthlyPrice: offer.monthlyPrice,
      yearlyPrice: offer.yearlyPrice,
      allowedCycles: offer.allowedCycles,
    });

    const siblings = await ctx.db
      .query("commercialOffers")
      .withIndex("by_organization", (q) => q.eq("organizationId", offer.organizationId))
      .collect();

    const now = Date.now();
    for (const sibling of siblings) {
      if (sibling._id === offer._id) continue;
      if (sibling.status === "active" || sibling.status === "accepted") {
        await ctx.db.patch(sibling._id, {
          status: "withdrawn",
          updatedAt: now,
        });
        await writeAuditLog(ctx, {
          actorId: userId,
          organizationId: offer.organizationId,
          action: "platform_commercial_offer_withdraw",
          entityType: "commercialOffers",
          entityId: sibling._id,
          metadata: { reason: "superseded_by_activation", supersededBy: args.offerId },
        });
      }
    }

    await ctx.db.patch(args.offerId, {
      status: "active",
      approvedBy: userId,
      updatedAt: now,
    });
    await bumpEntitlementVersion(ctx, offer.organizationId);

    await writeAuditLog(ctx, {
      actorId: userId,
      organizationId: offer.organizationId,
      action: "platform_commercial_offer_activate",
      entityType: "commercialOffers",
      entityId: args.offerId,
      metadata: {
        name: offer.name,
        basePlanKey: offer.basePlanKey,
        monthlyPrice: offer.monthlyPrice ?? null,
        yearlyPrice: offer.yearlyPrice ?? null,
      },
    });

    return args.offerId;
  },
});

export const withdraw = mutation({
  args: { offerId: v.id("commercialOffers") },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new Error("Commercial offer not found.");
    if (offer.status === "withdrawn" || offer.status === "expired") {
      return args.offerId;
    }
    if (offer.status === "accepted") {
      throw new Error("Accepted offers cannot be withdrawn silently. Create a new revision.");
    }

    const wasLive = offer.status === "active";
    await ctx.db.patch(args.offerId, {
      status: "withdrawn",
      updatedAt: Date.now(),
    });
    if (wasLive) {
      await bumpEntitlementVersion(ctx, offer.organizationId);
    }

    await writeAuditLog(ctx, {
      actorId: userId,
      organizationId: offer.organizationId,
      action: "platform_commercial_offer_withdraw",
      entityType: "commercialOffers",
      entityId: args.offerId,
      metadata: { previousStatus: offer.status, name: offer.name },
    });

    return args.offerId;
  },
});

// ─── Tenant (session-scoped; never returns notesInternal) ────────────────────

/**
 * Tenant: the signed-in organization's live commercial offer, if any.
 * Returns null when none is assigned. Never accepts organizationId from the client.
 * Strips internal notes and gateway plan codes.
 */
export const myActiveOffer = query({
  args: {},
  handler: async (ctx): Promise<TenantCommercialOffer | null> => {
    const session = await requireSessionIgnoringLicense(ctx);
    if (session.profile.role !== "administrator") {
      throw new Error("Only administrators can view commercial offers");
    }
    const offer = await loadLiveOfferForOrganization(ctx, session.organizationId);
    return offer ? toTenantCommercialOffer(offer) : null;
  },
});

/**
 * Tenant: mark the organization's active offer as accepted.
 * Payment still goes through billing checkout — this only records commercial consent.
 */
export const acceptOffer = mutation({
  args: { offerId: v.id("commercialOffers") },
  handler: async (ctx, args) => {
    const session = await requireSessionIgnoringLicense(ctx);
    if (session.profile.role !== "administrator") {
      throw new Error("Only administrators can accept commercial offers");
    }

    const offer = await ctx.db.get(args.offerId);
    if (!offer || offer.organizationId !== session.organizationId) {
      throw new Error("Commercial offer not found");
    }
    if (!isCommercialOfferLive(offer)) {
      throw new Error("This commercial offer is no longer available");
    }
    if (offer.status === "accepted") {
      return offer._id;
    }
    if (offer.status !== "active") {
      throw new Error("Only an active offer can be accepted");
    }

    const now = Date.now();
    await ctx.db.patch(offer._id, {
      status: "accepted",
      acceptedAt: now,
      updatedAt: now,
    });
    await bumpEntitlementVersion(ctx, session.organizationId);

    await writeAuditLog(ctx, {
      organizationId: session.organizationId,
      actorId: session.userId,
      action: "commercial_offer_accepted",
      entityType: "commercialOffers",
      entityId: offer._id,
      metadata: { basePlanKey: offer.basePlanKey, name: offer.name },
    });

    return offer._id;
  },
});

/** Internal: full offer document for billing checkout (includes gateway codes). */
export const liveOfferForOrganization = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await loadLiveOfferForOrganization(ctx, args.organizationId);
  },
});

/** Internal: persist Paystack plan codes for a private offer (never the public catalog). */
export const saveOfferGatewayCodes = internalMutation({
  args: {
    offerId: v.id("commercialOffers"),
    monthlyCode: v.optional(v.string()),
    yearlyCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const offer = await ctx.db.get(args.offerId);
    if (!offer) return;
    await ctx.db.patch(offer._id, {
      ...(args.monthlyCode !== undefined ? { gatewayMonthlyPlanCode: args.monthlyCode } : {}),
      ...(args.yearlyCode !== undefined ? { gatewayYearlyPlanCode: args.yearlyCode } : {}),
      updatedAt: Date.now(),
    });
  },
});
