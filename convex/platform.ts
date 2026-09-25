import { createAccount, getAuthUserId, modifyAccountCredentials } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { getPlatformAdmin, requirePlatformAdmin } from "./shared/permissions";
import {
  isPlatformRole,
  permissionsForRole,
  PLATFORM_ROLE_DESCRIPTIONS,
  PLATFORM_ROLE_LABELS,
  PLATFORM_ROLES,
  resolvePlatformRole,
  type PlatformRole,
} from "./shared/platformRoles";
import { assertPasswordPolicy } from "./shared/passwordPolicy";
import { notifyPasswordChanged } from "./shared/transactionalEmail";
import { sanitizeOptionalText, TEXT_LIMITS } from "./shared/validation";
import { writeAuditLog } from "./shared/audit";
import { planKeyValidator, billingCycleValidator, cloudModeValidator } from "./schema";
import { effectivePlanLimits, resolvePlan } from "./shared/plans";
import { planCapabilities } from "./shared/capabilities";
import { countExportFormats, loadOrganizationImportExport } from "./shared/importExportSnapshot";
import {
  resolveLicense,
  getActiveSubscription,
  resolveAllowedCloudModes,
} from "./shared/entitlements";
import { hasPendingOrganizationClosure } from "./shared/accountClosure";
import { provisionOrganization } from "./shared/provisionOrganization";
import { GRACE_PERIOD_MS } from "./shared/licensing";
import { archiveOrganizationRecord } from "./shared/accountClosure";
import { readOrgPlatformStatsOrZero } from "./shared/organizationStats";
import { normalizeCloudMode } from "./shared/cloudMode";
import { bumpEntitlementVersion } from "./shared/entitlementVersion";
import {
  onOrganizationCloudModeChanged,
  onOrganizationStatusChanged,
  readPlatformStats,
} from "./shared/platformStatsAggregate";
import { loadProductImagesPolicy, writeProductImagesPolicy } from "./settings";
import { PRODUCT_IMAGES_SETTINGS_KEY } from "./shared/productImagesPolicy";
import {
  featureSourceLabel,
  resolveFeatureEffectiveSource,
  resolveOrganizationConfig,
} from "./shared/organizationConfig";
import { FEATURE_KEYS, FEATURE_REGISTRY } from "./shared/features";
import { loadLiveOfferForOrganization } from "./shared/commercialOffers";
import { indexLiveOffersByOrganization } from "./shared/platformRevenue";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        isPlatformAdmin: false as const,
        userId: null,
        name: null,
        email: null,
        role: null,
        permissions: [] as import("./shared/platformRoles").PlatformPermission[],
      };
    }
    const admin = await getPlatformAdmin(ctx, userId);
    if (!admin || admin.status === "disabled") {
      return {
        isPlatformAdmin: false as const,
        userId: null,
        name: null,
        email: null,
        role: null,
        permissions: [] as import("./shared/platformRoles").PlatformPermission[],
      };
    }
    const user = await ctx.db.get(userId);
    const role = resolvePlatformRole(admin);
    return {
      isPlatformAdmin: true as const,
      userId,
      name: user?.name ?? user?.email ?? "Platform admin",
      email: user?.email ?? null,
      role,
      permissions: [...permissionsForRole(role)],
    };
  },
});

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx, "overview.read");
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    const [organizations, orgStats, recentSales, exportEvents, globalStats, commercialOffers] =
      await Promise.all([
        ctx.db.query("organizations").collect(),
        ctx.db.query("organizationPlatformStats").collect(),
        ctx.db
          .query("sales")
          .withIndex("by_completedAt", (q) => q.gte("completedAt", dayAgo))
          .collect(),
        // Export volume is small vs sales/products; kept for format breakdown only.
        ctx.db.query("exportEvents").collect(),
        readPlatformStats(ctx),
        ctx.db.query("commercialOffers").collect(),
      ]);

    const liveOffersByOrg = indexLiveOffersByOrganization(commercialOffers, now);
    const statsByOrg = new Map(orgStats.map((row) => [String(row.organizationId), row]));
    let userCount = 0;
    let branchCount = 0;
    let saleCount = 0;
    let importJobCount = 0;
    let failedImportJobs = 0;
    let exportEventCount = 0;
    for (const row of orgStats) {
      userCount += row.userCount;
      branchCount += row.branchCount;
      saleCount += row.saleCount;
      importJobCount += row.importJobCount;
      failedImportJobs += row.failedImportCount;
      exportEventCount += row.exportEventCount;
    }

    let csvOnlyOrganizations = 0;
    const orgsNearImportCap: Array<{
      id: (typeof organizations)[number]["_id"];
      name: string;
      productsUsed: number;
      productLimit: number;
      maxImportRows: number;
      percent: number;
      productLimitOverridden: boolean;
    }> = [];

    for (const org of organizations) {
      const plan = resolvePlan(org.planKey);
      const offer = liveOffersByOrg.get(String(org._id));
      const limits = effectivePlanLimits(
        plan,
        org.backupLimitBytes,
        org.limitOverrides,
        offer?.limitOverrides,
      );
      const caps = planCapabilities(plan.key, limits);
      if (!caps.canExportXlsx) csvOnlyOrganizations += 1;
      if (limits.products === null) continue;
      const productsUsed = statsByOrg.get(String(org._id))?.productCount ?? 0;
      const percent =
        limits.products === 0 ? 100 : Math.round((productsUsed / limits.products) * 100);
      if (percent < 80) continue;
      orgsNearImportCap.push({
        id: org._id,
        name: org.name,
        productsUsed,
        productLimit: limits.products,
        maxImportRows: caps.maxImportRows,
        percent,
        productLimitOverridden:
          org.limitOverrides?.products !== undefined ||
          offer?.limitOverrides?.products !== undefined,
      });
    }
    orgsNearImportCap.sort((a, b) => b.percent - a.percent);

    // Cloud-mode distribution: prefer the incremental singleton, fall back to a
    // fresh scan of the collected organizations so the card is never blank
    // before the first rebuild.
    const cloudModeCounts = globalStats
      ? {
          fullSync: globalStats.fullSyncCount,
          backupOnly: globalStats.backupOnlyCount,
          localOnly: globalStats.localOnlyCount,
        }
      : organizations.reduce(
          (acc, org) => {
            const mode = normalizeCloudMode(org.cloudMode);
            if (mode === "backup_only") acc.backupOnly += 1;
            else if (mode === "local_only") acc.localOnly += 1;
            else acc.fullSync += 1;
            return acc;
          },
          { fullSync: 0, backupOnly: 0, localOnly: 0 },
        );

    return {
      organizationCount: globalStats?.organizationCount ?? organizations.length,
      activeOrganizations:
        globalStats?.activeOrganizationCount ??
        organizations.filter((org) => org.status === "active").length,
      trialOrganizations: organizations.filter((org) => org.status === "trial").length,
      suspendedOrganizations: organizations.filter((org) => org.status === "suspended").length,
      expiredOrganizations: organizations.filter((org) => org.status === "expired").length,
      inactiveOrganizations: organizations.filter(
        (org) => org.status === "inactive" || org.status === "disabled",
      ).length,
      cloudModeCounts,
      userCount,
      branchCount,
      saleCount,
      salesLast24h: recentSales.length,
      importJobCount,
      failedImportJobs,
      exportEventCount: Math.max(exportEventCount, exportEvents.length),
      exportsByFormat: countExportFormats(exportEvents),
      csvOnlyOrganizations,
      orgsNearImportCap: orgsNearImportCap.slice(0, 8),
      recentOrganizations: organizations
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 8)
        .map((org) => ({
          id: org._id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          isTestOrganization: org.isTestOrganization === true,
          plan: resolvePlan(org.planKey).name,
          createdAt: org.createdAt,
        })),
    };
  },
});

export const listOrganizations = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx, "orgs.read");
    let orgs = await ctx.db.query("organizations").collect();
    if (args.search?.trim()) {
      const q = args.search.trim().toLowerCase();
      orgs = orgs.filter((org) => org.name.toLowerCase().includes(q) || org.slug.includes(q));
    }
    const [orgStats, commercialOffers] = await Promise.all([
      ctx.db.query("organizationPlatformStats").collect(),
      ctx.db.query("commercialOffers").collect(),
    ]);
    const statsByOrg = new Map(orgStats.map((row) => [String(row.organizationId), row]));
    const liveOffersByOrg = indexLiveOffersByOrganization(commercialOffers);
    return orgs
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((org) => {
        const stats = statsByOrg.get(String(org._id));
        const plan = resolvePlan(org.planKey);
        const offer = liveOffersByOrg.get(String(org._id));
        const limits = effectivePlanLimits(
          plan,
          org.backupLimitBytes,
          org.limitOverrides,
          offer?.limitOverrides,
        );
        const caps = planCapabilities(plan.key, limits);
        return {
          id: org._id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          isTestOrganization: org.isTestOrganization === true,
          planKey: plan.key,
          plan: plan.name,
          currency: org.currency,
          createdAt: org.createdAt,
          trialEndsAt: org.trialEndsAt ?? null,
          userCount: stats?.userCount ?? 0,
          saleCount: stats?.saleCount ?? 0,
          productsUsed: stats?.productCount ?? 0,
          productLimit: limits.products,
          maxImportRows: caps.maxImportRows,
          canExportXlsx: caps.canExportXlsx,
          canExportPdf: caps.canExportPdf,
          importJobCount: stats?.importJobCount ?? 0,
          failedImportCount: stats?.failedImportCount ?? 0,
          exportEventCount: stats?.exportEventCount ?? 0,
          productLimitOverridden:
            org.limitOverrides?.products !== undefined ||
            offer?.limitOverrides?.products !== undefined,
        };
      });
  },
});

export const getOrganization = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx, "orgs.read");
    const org = await ctx.db.get(args.organizationId);
    if (!org) return null;

    const owner = await ctx.db.get(org.ownerUserId);
    const businessRow = await ctx.db
      .query("settings")
      .withIndex("by_organization_key", (q) =>
        q.eq("organizationId", org._id).eq("key", "business.profile"),
      )
      .unique();
    let business: {
      tradeName?: string;
      legalName?: string;
      address?: string;
      phone?: string;
      email?: string;
      taxId?: string;
    } = {};
    if (businessRow?.value) {
      try {
        business = JSON.parse(businessRow.value) as typeof business;
      } catch {
        business = {};
      }
    }

    const [profiles, branches, wholesale, suppliers, customers, devices, backups] =
      await Promise.all([
        ctx.db
          .query("profiles")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .collect(),
        ctx.db
          .query("branches")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .collect(),
        ctx.db
          .query("wholesaleStock")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .collect(),
        ctx.db
          .query("suppliers")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .collect(),
        ctx.db
          .query("customers")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .collect(),
        ctx.db
          .query("devices")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .collect(),
        ctx.db
          .query("cloudBackups")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .collect(),
      ]);

    const stats = await readOrgPlatformStatsOrZero(ctx, org._id);
    const productImagesPolicy = await loadProductImagesPolicy(ctx, org._id);
    const now = Date.now();
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const [sales30d, lastSale] = await Promise.all([
      ctx.db
        .query("sales")
        .withIndex("by_organization_completedAt", (q) =>
          q.eq("organizationId", org._id).gte("completedAt", monthAgo),
        )
        .collect(),
      ctx.db
        .query("sales")
        .withIndex("by_organization_completedAt", (q) => q.eq("organizationId", org._id))
        .order("desc")
        .first(),
    ]);
    const revenue30d = sales30d.reduce((sum, s) => sum + s.total, 0);
    const lastSaleAt = lastSale?.completedAt ?? 0;

    const wholesaleProductIds = [...new Set(wholesale.map((row) => row.productId))];
    const wholesaleProducts = await Promise.all(
      wholesaleProductIds.map((productId) => ctx.db.get(productId)),
    );
    const costByProduct = new Map(
      wholesaleProducts
        .filter((product): product is NonNullable<typeof product> => product !== null)
        .map((product) => [product._id, product.costPrice]),
    );
    const wholesaleValue = wholesale.reduce(
      (sum, row) => sum + row.quantity * (costByProduct.get(row.productId) ?? 0),
      0,
    );
    const wholesaleUnits = wholesale.reduce((sum, row) => sum + row.quantity, 0);

    const users = await Promise.all(
      profiles.map(async (profile) => {
        const account = await ctx.db.get(profile.userId);
        const lastSeenAt = profile.lastSeenAt ?? null;
        return {
          id: profile._id,
          name: profile.name,
          role: profile.role,
          status: profile.status,
          email: account?.email ?? null,
          branchId: profile.branchId ?? null,
          lastSeenAt,
          lastLoginAt: profile.lastLoginAt ?? null,
          lastDevice: profile.lastDevice ?? null,
          online: lastSeenAt !== null && now - lastSeenAt <= 2 * 60 * 1000,
        };
      }),
    );

    const branchName = new Map(branches.map((b) => [b._id, b.name]));
    const lastActiveAt = profiles.reduce(
      (latest, p) => Math.max(latest, p.lastSeenAt ?? 0, p.lastLoginAt ?? 0),
      0,
    );
    const storageBytes = backups.reduce((sum, b) => sum + b.sizeBytes, 0);
    const activeDevices = devices.filter((d) => d.isActive);
    const lastSyncAt = devices.reduce((latest, d) => Math.max(latest, d.lastSeenAt ?? 0), 0);
    const license = await resolveLicense(ctx, org);
    const liveOffer = await loadLiveOfferForOrganization(ctx, org._id);
    const productCount = stats.productCount;
    const importExport = await loadOrganizationImportExport(ctx, {
      organizationId: org._id,
      planKey: license.planKey,
      limits: license.limits,
      productsUsed: productCount,
      productLimitOverridden:
        org.limitOverrides?.products !== undefined ||
        liveOffer?.limitOverrides?.products !== undefined,
    });

    return {
      id: org._id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      isTestOrganization: org.isTestOrganization === true,
      pendingClosure: hasPendingOrganizationClosure(org, now),
      closureRequestedAt: org.closureRequestedAt ?? null,
      closureEffectiveAt: org.closureEffectiveAt ?? null,
      closureReason: org.closureReason ?? null,
      country: org.country ?? null,
      planKey: resolvePlan(org.planKey).key,
      plan: resolvePlan(org.planKey).name,
      currency: org.currency,
      timezone: org.timezone ?? null,
      taxId: org.taxId ?? business.taxId ?? null,
      createdAt: org.createdAt,
      trialEndsAt: org.trialEndsAt ?? null,
      backupLimitBytes: org.backupLimitBytes ?? null,
      limitOverrides: org.limitOverrides ?? null,
      effectiveLimits: license.limits,
      productImagesEnabled: productImagesPolicy.enabled,
      owner: {
        userId: org.ownerUserId,
        name: owner?.name ?? null,
        email: owner?.email ?? null,
      },
      business: {
        tradeName: business.tradeName ?? org.name,
        legalName: business.legalName ?? org.name,
        address: business.address ?? "",
        phone: business.phone ?? "",
        email: business.email ?? owner?.email ?? "",
        taxId: business.taxId ?? org.taxId ?? "",
      },
      kpis: {
        userCount: profiles.length,
        adminCount: profiles.filter((p) => p.role === "administrator").length,
        managerCount: profiles.filter((p) => p.role === "manager").length,
        cashierCount: profiles.filter((p) => p.role === "cashier").length,
        branchCount: branches.length,
        productCount,
        supplierCount: suppliers.length,
        customerCount: customers.length,
        saleCount: stats.saleCount,
        saleCount30d: sales30d.length,
        revenueAll: stats.saleRevenueTotal,
        revenue30d,
        lastSaleAt: lastSaleAt || null,
        lastActiveAt: lastActiveAt || null,
        wholesaleUnits,
        wholesaleValue,
        storageBytes,
        deviceCount: activeDevices.length,
        deviceCountTotal: devices.length,
        lastSyncAt: lastSyncAt || null,
      },
      branches: branches
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((b) => ({
          id: b._id,
          name: b.name,
          code: b.code,
          status: b.status,
          phone: b.phone ?? null,
          address: b.address ?? null,
        })),
      users: users
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((u) => ({
          ...u,
          branchName: u.branchId ? (branchName.get(u.branchId) ?? null) : null,
        })),
      importExport,
    };
  },
});

export const setOrganizationStatus = mutation({
  args: {
    organizationId: v.id("organizations"),
    status: v.union(
      v.literal("active"),
      v.literal("trial"),
      v.literal("suspended"),
      v.literal("expired"),
      v.literal("disabled"),
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found");
    const previousStatus = org.status;
    await ctx.db.patch(args.organizationId, { status: args.status, updatedAt: Date.now() });
    await bumpEntitlementVersion(ctx, args.organizationId);
    await onOrganizationStatusChanged(ctx, { from: previousStatus, to: args.status });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "platform_set_org_status",
      entityType: "organizations",
      entityId: args.organizationId,
      metadata: { status: args.status },
    });
    return args.organizationId;
  },
});

/**
 * PEAS — mark an organization as a test/QA tenant so it is excluded from
 * platform MRR, ARR, and gross revenue.
 */
export const setOrganizationTestFlag = mutation({
  args: {
    organizationId: v.id("organizations"),
    isTestOrganization: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found");
    await ctx.db.patch(args.organizationId, {
      isTestOrganization: args.isTestOrganization,
      updatedAt: Date.now(),
    });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "platform_set_org_test_flag",
      entityType: "organizations",
      entityId: args.organizationId,
      metadata: { isTestOrganization: args.isTestOrganization },
    });
    return args.organizationId;
  },
});

/**
 * PEAS — Super Admin selection of the organization's cloud usage mode.
 *
 * Validated against the organization's allowed modes, audited, and reflected in
 * the entitlement version and platform aggregate. Switching to `local_only`
 * stops routine business synchronization (the client keeps operating locally
 * and still sends the minimal platform heartbeat). See CLOUD_MODE_PLAN_V2 (§42).
 */
export const setOrganizationCloudMode = mutation({
  args: {
    organizationId: v.id("organizations"),
    cloudMode: cloudModeValidator,
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found");
    const allowed = resolveAllowedCloudModes(org);
    if (!allowed.includes(args.cloudMode)) {
      throw new Error("That cloud mode is not permitted for this organization.");
    }
    const previousMode = normalizeCloudMode(org.cloudMode);
    if (previousMode === args.cloudMode) return args.organizationId;

    await ctx.db.patch(args.organizationId, { cloudMode: args.cloudMode, updatedAt: Date.now() });
    await bumpEntitlementVersion(ctx, args.organizationId);
    await onOrganizationCloudModeChanged(ctx, { from: previousMode, to: args.cloudMode });
    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      action: "platform_set_cloud_mode",
      entityType: "organizations",
      entityId: args.organizationId,
      metadata: { cloudMode: args.cloudMode, previousMode },
    });
    return args.organizationId;
  },
});

/** PEAS — edits the platform-owned registration profile (not tenant business settings). */
export const updateOrganizationProfile = mutation({
  args: {
    organizationId: v.id("organizations"),
    country: v.optional(v.string()),
    timezone: v.optional(v.string()),
    taxId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found");
    const country = sanitizeOptionalText(args.country, "Country", TEXT_LIMITS.name) ?? undefined;
    const timezone = sanitizeOptionalText(args.timezone, "Timezone", TEXT_LIMITS.name) ?? undefined;
    const taxId = sanitizeOptionalText(args.taxId, "Tax ID", TEXT_LIMITS.short) ?? undefined;
    await ctx.db.patch(args.organizationId, {
      country,
      timezone,
      taxId,
      updatedAt: Date.now(),
    });
    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      action: "platform_update_org_profile",
      entityType: "organizations",
      entityId: args.organizationId,
      metadata: { country, timezone, taxId },
    });
    return args.organizationId;
  },
});

const limitOverrideValue = v.optional(v.union(v.number(), v.null()));

/**
 * PEAS — Super Admin overrides for metered resources on top of the plan
 * catalog. Sending a key sets/clears that override; omitting a key leaves it
 * untouched. `null` means unlimited for that resource.
 */
export const setOrganizationLimitOverrides = mutation({
  args: {
    organizationId: v.id("organizations"),
    products: limitOverrideValue,
    users: limitOverrideValue,
    branches: limitOverrideValue,
    devices: limitOverrideValue,
    /** Resources to clear back to the plan default. */
    clear: v.optional(
      v.array(
        v.union(
          v.literal("products"),
          v.literal("users"),
          v.literal("branches"),
          v.literal("devices"),
        ),
      ),
    ),
    /**
     * Cloud entitlements (Phase G). `allowedCloudModes: null` clears the
     * restriction back to "all modes"; an array restricts selectable modes.
     * The boolean toggles default to enabled when the field is cleared.
     */
    allowedCloudModes: v.optional(v.union(v.array(cloudModeValidator), v.null())),
    cloudBackupEnabled: v.optional(v.boolean()),
    remoteMonitoringEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found");
    for (const [key, value] of [
      ["products", args.products],
      ["users", args.users],
      ["branches", args.branches],
      ["devices", args.devices],
    ] as const) {
      if (value !== undefined && value !== null && !(Number.isInteger(value) && value > 0)) {
        throw new Error(`${key} override must be a positive whole number or unlimited.`);
      }
    }

    const next = { ...(org.limitOverrides ?? {}) };
    for (const key of ["products", "users", "branches", "devices"] as const) {
      const value = args[key];
      if (value !== undefined) next[key] = value;
    }
    for (const key of args.clear ?? []) {
      delete next[key];
    }

    const patch: Partial<Doc<"organizations">> = {
      limitOverrides: next,
      updatedAt: Date.now(),
    };

    if (args.allowedCloudModes !== undefined) {
      // Clear the restriction (all modes allowed) with an empty array — Convex
      // has no delete-field, and `resolveAllowedCloudModes` treats [] as "all".
      patch.allowedCloudModes =
        args.allowedCloudModes === null || args.allowedCloudModes.length === 0
          ? []
          : Array.from(new Set(args.allowedCloudModes));
    }
    if (args.cloudBackupEnabled !== undefined) patch.cloudBackupEnabled = args.cloudBackupEnabled;
    if (args.remoteMonitoringEnabled !== undefined) {
      patch.remoteMonitoringEnabled = args.remoteMonitoringEnabled;
    }

    await ctx.db.patch(args.organizationId, patch);
    await bumpEntitlementVersion(ctx, args.organizationId);
    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      action: "platform_set_limit_overrides",
      entityType: "organizations",
      entityId: args.organizationId,
      metadata: {
        ...next,
        allowedCloudModes: args.allowedCloudModes ?? undefined,
        cloudBackupEnabled: args.cloudBackupEnabled,
        remoteMonitoringEnabled: args.remoteMonitoringEnabled,
      },
    });
    return next;
  },
});

/** Enable or disable product-image uploads for a tenant organization. */
export const setProductImagesEnabled = mutation({
  args: {
    organizationId: v.id("organizations"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found");
    const previous = await loadProductImagesPolicy(ctx, args.organizationId);
    const policy = await writeProductImagesPolicy(ctx, args.organizationId, args.enabled);
    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      action: "platform_set_product_images_policy",
      entityType: "settings",
      entityId: PRODUCT_IMAGES_SETTINGS_KEY,
      metadata: {
        enabled: policy.enabled,
        previousEnabled: previous.enabled,
        organizationId: args.organizationId,
      },
    });
    return policy;
  },
});

/** PEAS — extends the active subscription's expiry (or a running trial) by N days. */
export const extendSubscription = mutation({
  args: { organizationId: v.id("organizations"), days: v.number() },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    if (!(Number.isInteger(args.days) && args.days > 0 && args.days <= 3650)) {
      throw new Error("Enter a whole number of days from 1 to 3650.");
    }
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found");
    const extraMs = args.days * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const subscription = await getActiveSubscription(ctx, org);

    if (subscription && !subscription.isLifetime) {
      const base = Math.max(subscription.expiresAt ?? now, now);
      const expiresAt = base + extraMs;
      await ctx.db.patch(subscription._id, {
        expiresAt,
        nextBillingDate: expiresAt,
        graceUntil: expiresAt + GRACE_PERIOD_MS,
        status: subscription.status === "expired" ? "active" : subscription.status,
        updatedAt: now,
      });
    } else if (org.trialEndsAt) {
      await ctx.db.patch(args.organizationId, {
        trialEndsAt: Math.max(org.trialEndsAt, now) + extraMs,
        updatedAt: now,
      });
    } else {
      throw new Error("No subscription or trial to extend. Assign a plan first.");
    }

    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      action: "platform_extend_subscription",
      entityType: "organizations",
      entityId: args.organizationId,
      metadata: { days: args.days },
    });
    return { extended: true };
  },
});

/**
 * PEAS — archives an organization instead of deleting business records.
 * Deactivates every device and blocks all access; data is retained for audit
 * and potential reinstatement via `setOrganizationStatus`.
 */
export const archiveOrganization = mutation({
  args: { organizationId: v.id("organizations"), confirmName: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found");
    if (args.confirmName.trim() !== org.name) {
      throw new Error("Type the exact organization name to confirm.");
    }

    const { deactivatedDevices } = await archiveOrganizationRecord(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      auditAction: "platform_archive_organization",
    });
    return { archived: true, deactivatedDevices };
  },
});

export const bootstrap = action({
  args: {
    bootstrapSecret: v.string(),
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    if (process.env.BOOTSTRAP_PLATFORM_ENABLED !== "true") {
      throw new Error(
        "Platform bootstrap is disabled. Enable it temporarily for first-time setup.",
      );
    }
    const expected = process.env.BOOTSTRAP_PLATFORM_SECRET ?? process.env.BOOTSTRAP_ADMIN_SECRET;
    if (!expected || args.bootstrapSecret !== expected) {
      throw new Error("Invalid bootstrap secret");
    }
    const existing = await ctx.runQuery(api.platform.hasAnyAdmin, {});
    if (existing) {
      throw new Error("A platform administrator already exists");
    }
    const email = args.email.trim().toLowerCase();
    const name = args.name.trim();
    const password = args.password;
    if (!email || !name) throw new Error("Name and email are required");
    assertPasswordPolicy(password);
    const created = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: password },
      profile: { email, name },
    });
    await ctx.runMutation(internal.platform.recordAdmin, {
      userId: created.user._id,
    });
    return { userId: created.user._id };
  },
});

export const hasAnyAdmin = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("platformAdmins").first();
    return Boolean(row);
  },
});

export const recordAdmin = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("platformAdmins").first();
    if (existing) throw new Error("A platform administrator already exists");
    return await ctx.db.insert("platformAdmins", {
      userId: args.userId,
      role: "owner",
      status: "active",
      createdAt: Date.now(),
    });
  },
});

const platformRoleValidator = v.union(
  v.literal("owner"),
  v.literal("operator"),
  v.literal("support"),
  v.literal("analyst"),
);

export const listStaff = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx, "staff.manage");
    const rows = await ctx.db.query("platformAdmins").collect();
    const items = await Promise.all(
      rows.map(async (row) => {
        const user = await ctx.db.get(row.userId);
        const role = resolvePlatformRole(row);
        return {
          id: row._id,
          userId: row.userId,
          name: user?.name ?? user?.email ?? "Unknown",
          email: user?.email ?? null,
          role,
          roleLabel: PLATFORM_ROLE_LABELS[role],
          status: row.status === "disabled" ? ("disabled" as const) : ("active" as const),
          createdAt: row.createdAt,
          permissions: [...permissionsForRole(role)],
        };
      }),
    );
    return {
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
      roles: PLATFORM_ROLES.map((role) => ({
        value: role,
        label: PLATFORM_ROLE_LABELS[role],
        description: PLATFORM_ROLE_DESCRIPTIONS[role],
      })),
    };
  },
});

export const createStaffAccount = action({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
    role: platformRoleValidator,
  },
  handler: async (ctx, args): Promise<{ userId: Id<"users"> }> => {
    const gate = await ctx.runQuery(api.platform.me, {});
    if (!gate.isPlatformAdmin || !gate.userId || !gate.permissions.includes("staff.manage")) {
      throw new Error("Forbidden");
    }
    if (args.role === "owner" && gate.role !== "owner") {
      throw new Error("Only an owner can create another owner");
    }
    const email = args.email.trim().toLowerCase();
    const name = args.name.trim();
    if (!email || !name) throw new Error("Name and email are required");
    assertPasswordPolicy(args.password);

    const created = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: args.password },
      profile: { email, name },
    });

    await ctx.runMutation(internal.platform.insertStaffAdmin, {
      userId: created.user._id,
      role: args.role,
      createdBy: gate.userId,
    });
    return { userId: created.user._id };
  },
});

/** Insert platform staff after the auth account exists. */
export const insertStaffAdmin = internalMutation({
  args: {
    userId: v.id("users"),
    role: platformRoleValidator,
    createdBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const existing = await getPlatformAdmin(ctx, args.userId);
    if (existing) throw new Error("This user is already a platform administrator");
    const id = await ctx.db.insert("platformAdmins", {
      userId: args.userId,
      role: args.role,
      status: "active",
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
    if (args.createdBy) {
      await writeAuditLog(ctx, {
        actorId: args.createdBy,
        action: "platform_staff_created",
        entityType: "platformAdmins",
        entityId: id,
        metadata: { userId: args.userId, role: args.role },
      });
    }
    return id;
  },
});

export const updateStaff = mutation({
  args: {
    adminId: v.id("platformAdmins"),
    role: v.optional(platformRoleValidator),
    status: v.optional(v.union(v.literal("active"), v.literal("disabled"))),
  },
  handler: async (ctx, args) => {
    const { userId: actorId, role: actorRole } = await requirePlatformAdmin(ctx, "staff.manage");
    const row = await ctx.db.get(args.adminId);
    if (!row) throw new Error("Staff member not found");
    const currentRole = resolvePlatformRole(row);

    if (row.userId === actorId && args.status === "disabled") {
      throw new Error("You cannot disable your own platform access");
    }
    if (args.role === "owner" && actorRole !== "owner") {
      throw new Error("Only an owner can assign the owner role");
    }
    if (currentRole === "owner" && (args.role !== undefined || args.status === "disabled")) {
      const owners = (await ctx.db.query("platformAdmins").collect()).filter(
        (r) => resolvePlatformRole(r) === "owner" && r.status !== "disabled",
      );
      if (
        owners.length <= 1 &&
        (args.status === "disabled" || (args.role !== undefined && args.role !== "owner"))
      ) {
        throw new Error("Keep at least one active platform owner");
      }
    }

    const patch: { role?: PlatformRole; status?: "active" | "disabled" } = {};
    if (args.role !== undefined) {
      if (!isPlatformRole(args.role)) throw new Error("Invalid role");
      patch.role = args.role;
    }
    if (args.status !== undefined) patch.status = args.status;
    if (Object.keys(patch).length === 0) return args.adminId;

    await ctx.db.patch(args.adminId, patch);
    await writeAuditLog(ctx, {
      actorId,
      action: "platform_staff_updated",
      entityType: "platformAdmins",
      entityId: args.adminId,
      metadata: patch,
    });
    return args.adminId;
  },
});

export const createOrganization = action({
  args: {
    name: v.string(),
    currency: v.optional(v.string()),
    adminName: v.string(),
    adminEmail: v.string(),
    adminPassword: v.string(),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    planKey: v.optional(planKeyValidator),
    cycle: v.optional(billingCycleValidator),
    trial: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ organizationId: Id<"organizations">; branchId: Id<"branches"> }> => {
    const gate = await ctx.runQuery(api.platform.me, {});
    if (!gate.isPlatformAdmin || !gate.permissions.includes("orgs.write")) {
      throw new Error("Forbidden");
    }

    const result = await ctx.runMutation(api.platform.insertOrganization, {
      name: args.name,
      currency: args.currency,
      phone: args.phone,
      address: args.address,
      planKey: args.planKey,
      cycle: args.cycle,
      trial: args.trial,
    });

    const email = args.adminEmail.trim().toLowerCase();
    const created = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: args.adminPassword },
      profile: { email, name: args.adminName.trim() },
    });
    await ctx.runMutation(internal.users.insertProfileForUser, {
      userId: created.user._id,
      name: args.adminName.trim(),
      role: "administrator",
      branchId: result.branchId,
      organizationId: result.organizationId,
    });
    await ctx.runMutation(api.platform.attachOwner, {
      organizationId: result.organizationId,
      ownerUserId: created.user._id,
    });
    return result;
  },
});

export const insertOrganization = mutation({
  args: {
    name: v.string(),
    currency: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    planKey: v.optional(planKeyValidator),
    cycle: v.optional(billingCycleValidator),
    /** Provision on a trial instead of activating a plan immediately. */
    trial: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const trial = args.trial !== false;
    return await provisionOrganization(ctx, {
      name: args.name,
      currency: args.currency,
      phone: args.phone,
      address: args.address,
      ownerUserId: userId,
      actorId: userId,
      license: trial
        ? { kind: "trial", planKey: args.planKey ?? "pro" }
        : { kind: "activate", planKey: args.planKey ?? "lifetime", cycle: args.cycle },
      auditAction: "platform_create_organization",
    });
  },
});

export const attachOwner = mutation({
  args: {
    organizationId: v.id("organizations"),
    ownerUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    await ctx.db.patch(args.organizationId, { ownerUserId: args.ownerUserId });
  },
});

export const resetOrganizationAdminPassword = action({
  args: {
    organizationId: v.id("organizations"),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const gate = await ctx.runQuery(api.platform.me, {});
    if (!gate.isPlatformAdmin) throw new Error("Forbidden");
    assertPasswordPolicy(args.newPassword);
    const email = await ctx.runQuery(api.platform.ownerEmail, {
      organizationId: args.organizationId,
    });
    if (!email) throw new Error("Organization owner email not found");
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: email, secret: args.newPassword },
    });
    await notifyPasswordChanged(email);
    return { ok: true as const };
  },
});

export const ownerEmail = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) return null;
    const owner = await ctx.db.get(org.ownerUserId);
    return owner?.email ?? null;
  },
});

/**
 * Resolved organization configuration for the platform admin detail view
 * (experience tokens, effective features, billing visibility, commercial summary).
 */
export const getOrganizationConfig = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx, "orgs.read");
    const org = await ctx.db.get(args.organizationId);
    if (!org) return null;

    const [preset, template, liveOffer] = await Promise.all([
      org.experiencePresetId ? ctx.db.get(org.experiencePresetId) : null,
      org.featureTemplateId ? ctx.db.get(org.featureTemplateId) : null,
      loadLiveOfferForOrganization(ctx, org._id),
    ]);

    const resolved = resolveOrganizationConfig({
      organization: org,
      planKey: org.planKey,
      preset,
      template,
      offer: liveOffer,
    });

    const plan = resolvePlan(org.planKey);
    const featureRows = FEATURE_KEYS.map((feature) => {
      const source = resolveFeatureEffectiveSource({
        feature,
        organization: org,
        planKey: org.planKey,
        template,
        offer: liveOffer,
        effective: resolved.features[feature],
      });
      const override = org.featureOverrides?.find((row) => row.feature === feature);
      return {
        feature,
        label: FEATURE_REGISTRY[feature].label,
        description: FEATURE_REGISTRY[feature].description,
        category: FEATURE_REGISTRY[feature].category,
        prerequisites: FEATURE_REGISTRY[feature].prerequisites,
        effective: resolved.features[feature],
        override: override?.value ?? ("inherit" as const),
        source,
        sourceLabel: featureSourceLabel(source, {
          planName: plan.name,
          templateName: template?.name,
        }),
      };
    });

    return {
      resolved,
      assignment: {
        experiencePresetId: org.experiencePresetId ?? null,
        experienceOverrides: org.experienceOverrides ?? null,
        experienceVersion: org.experienceVersion ?? 0,
        featureTemplateId: org.featureTemplateId ?? null,
        featureOverrides: org.featureOverrides ?? [],
        featureEntitlementVersion: org.featureEntitlementVersion ?? 0,
        billingVisibility: org.billingVisibility ?? ("visible" as const),
        entitlementVersion: org.entitlementVersion ?? 0,
      },
      preset: preset
        ? {
            id: preset._id,
            key: preset.key,
            name: preset.name,
            status: preset.status,
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
        : null,
      template: template
        ? {
            id: template._id,
            key: template.key,
            name: template.name,
            status: template.status,
          }
        : null,
      offer: liveOffer
        ? {
            id: liveOffer._id,
            name: liveOffer.name,
            status: liveOffer.status,
            basePlanKey: liveOffer.basePlanKey,
          }
        : null,
      featureRows,
    };
  },
});
