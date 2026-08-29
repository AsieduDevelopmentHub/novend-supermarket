import { createAccount, getAuthUserId, modifyAccountCredentials } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { getPlatformAdmin, requirePlatformAdmin } from "./shared/permissions";
import { assertPasswordPolicy } from "./shared/passwordPolicy";
import { notifyPasswordChanged } from "./shared/transactionalEmail";
import { sanitizeOptionalText, TEXT_LIMITS } from "./shared/validation";
import { writeAuditLog } from "./shared/audit";
import { planKeyValidator, billingCycleValidator } from "./schema";
import { effectivePlanLimits, resolvePlan } from "./shared/plans";
import { planCapabilities } from "./shared/capabilities";
import {
  countExportFormats,
  groupRowsByOrganization,
  loadOrganizationImportExport,
} from "./shared/importExportSnapshot";
import { resolveLicense, getActiveSubscription } from "./shared/entitlements";
import { provisionOrganization } from "./shared/provisionOrganization";
import { GRACE_PERIOD_MS } from "./shared/licensing";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { isPlatformAdmin: false as const, name: null, email: null };
    const admin = await getPlatformAdmin(ctx, userId);
    if (!admin) return { isPlatformAdmin: false as const, name: null, email: null };
    const user = await ctx.db.get(userId);
    return {
      isPlatformAdmin: true as const,
      name: user?.name ?? user?.email ?? "Platform admin",
      email: user?.email ?? null,
    };
  },
});

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);
    const [organizations, profiles, branches, sales, products, importJobs, exportEvents] =
      await Promise.all([
        ctx.db.query("organizations").collect(),
        ctx.db.query("profiles").collect(),
        ctx.db.query("branches").collect(),
        ctx.db.query("sales").collect(),
        ctx.db.query("products").collect(),
        ctx.db.query("importJobs").collect(),
        ctx.db.query("exportEvents").collect(),
      ]);

    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const recentSales = sales.filter((sale) => sale.completedAt >= dayAgo);
    const productsUsedByOrg = new Map<string, number>();
    for (const product of products) {
      if (product.status === "archived") continue;
      const key = String(product.organizationId);
      productsUsedByOrg.set(key, (productsUsedByOrg.get(key) ?? 0) + 1);
    }

    let csvOnlyOrganizations = 0;
    const orgsNearImportCap: Array<{
      id: typeof organizations[number]["_id"];
      name: string;
      productsUsed: number;
      productLimit: number;
      maxImportRows: number;
      percent: number;
      productLimitOverridden: boolean;
    }> = [];

    for (const org of organizations) {
      const plan = resolvePlan(org.planKey);
      const limits = effectivePlanLimits(plan, org.backupLimitBytes, org.limitOverrides);
      const caps = planCapabilities(plan.key, limits);
      if (!caps.canExportXlsx) csvOnlyOrganizations += 1;
      if (limits.products === null) continue;
      const productsUsed = productsUsedByOrg.get(String(org._id)) ?? 0;
      const percent = limits.products === 0 ? 100 : Math.round((productsUsed / limits.products) * 100);
      if (percent < 80) continue;
      orgsNearImportCap.push({
        id: org._id,
        name: org.name,
        productsUsed,
        productLimit: limits.products,
        maxImportRows: caps.maxImportRows,
        percent,
        productLimitOverridden: org.limitOverrides?.products !== undefined,
      });
    }
    orgsNearImportCap.sort((a, b) => b.percent - a.percent);

    return {
      organizationCount: organizations.length,
      activeOrganizations: organizations.filter((org) => org.status === "active").length,
      trialOrganizations: organizations.filter((org) => org.status === "trial").length,
      suspendedOrganizations: organizations.filter((org) => org.status === "suspended").length,
      expiredOrganizations: organizations.filter((org) => org.status === "expired").length,
      inactiveOrganizations: organizations.filter(
        (org) => org.status === "inactive" || org.status === "disabled",
      ).length,
      userCount: profiles.length,
      branchCount: branches.length,
      saleCount: sales.length,
      salesLast24h: recentSales.length,
      importJobCount: importJobs.length,
      failedImportJobs: importJobs.filter((job) => job.status === "failed").length,
      exportEventCount: exportEvents.length,
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
          plan: resolvePlan(org.planKey).name,
          createdAt: org.createdAt,
        })),
    };
  },
});

export const listOrganizations = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    let orgs = await ctx.db.query("organizations").collect();
    if (args.search?.trim()) {
      const q = args.search.trim().toLowerCase();
      orgs = orgs.filter((org) => org.name.toLowerCase().includes(q) || org.slug.includes(q));
    }
    const [profiles, sales, products, importJobs, exportEvents] = await Promise.all([
      ctx.db.query("profiles").collect(),
      ctx.db.query("sales").collect(),
      ctx.db.query("products").collect(),
      ctx.db.query("importJobs").collect(),
      ctx.db.query("exportEvents").collect(),
    ]);
    const jobsByOrg = groupRowsByOrganization(importJobs);
    const exportsByOrg = groupRowsByOrganization(exportEvents);
    const productsUsedByOrg = new Map<string, number>();
    for (const product of products) {
      if (product.status === "archived") continue;
      const key = String(product.organizationId);
      productsUsedByOrg.set(key, (productsUsedByOrg.get(key) ?? 0) + 1);
    }
    return orgs
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((org) => {
        const staff = profiles.filter((p) => p.organizationId === org._id);
        const orgSales = sales.filter((s) => s.organizationId === org._id);
        const plan = resolvePlan(org.planKey);
        const limits = effectivePlanLimits(plan, org.backupLimitBytes, org.limitOverrides);
        const caps = planCapabilities(plan.key, limits);
        const orgJobs = jobsByOrg.get(String(org._id)) ?? [];
        const orgExports = exportsByOrg.get(String(org._id)) ?? [];
        return {
          id: org._id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          planKey: plan.key,
          plan: plan.name,
          currency: org.currency,
          createdAt: org.createdAt,
          trialEndsAt: org.trialEndsAt ?? null,
          userCount: staff.length,
          saleCount: orgSales.length,
          productsUsed: productsUsedByOrg.get(String(org._id)) ?? 0,
          productLimit: limits.products,
          maxImportRows: caps.maxImportRows,
          canExportXlsx: caps.canExportXlsx,
          canExportPdf: caps.canExportPdf,
          importJobCount: orgJobs.length,
          failedImportCount: orgJobs.filter((job) => job.status === "failed").length,
          exportEventCount: orgExports.length,
          productLimitOverridden: org.limitOverrides?.products !== undefined,
        };
      });
  },
});

export const getOrganization = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
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

    const [profiles, branches, products, sales, wholesale, suppliers, customers, devices, backups] =
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
          .query("products")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .collect(),
        ctx.db
          .query("sales")
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

    const now = Date.now();
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const recentSales = sales.filter((s) => s.completedAt >= monthAgo);
    const revenueAll = sales.reduce((sum, s) => sum + s.total, 0);
    const revenue30d = recentSales.reduce((sum, s) => sum + s.total, 0);
    const lastSaleAt = sales.reduce((latest, s) => Math.max(latest, s.completedAt), 0);
    const costByProduct = new Map(products.map((p) => [p._id, p.costPrice]));
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
    const productCount = products.filter((p) => p.status !== "archived").length;
    const importExport = await loadOrganizationImportExport(ctx, {
      organizationId: org._id,
      planKey: license.planKey,
      limits: license.limits,
      productsUsed: productCount,
      productLimitOverridden: org.limitOverrides?.products !== undefined,
    });

    return {
      id: org._id,
      name: org.name,
      slug: org.slug,
      status: org.status,
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
        saleCount: sales.length,
        saleCount30d: recentSales.length,
        revenueAll,
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
    await ctx.db.patch(args.organizationId, { status: args.status, updatedAt: Date.now() });
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

    await ctx.db.patch(args.organizationId, { limitOverrides: next, updatedAt: Date.now() });
    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      action: "platform_set_limit_overrides",
      entityType: "organizations",
      entityId: args.organizationId,
      metadata: next,
    });
    return next;
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

    const devices = await ctx.db
      .query("devices")
      .withIndex("by_organization_active", (q) =>
        q.eq("organizationId", args.organizationId).eq("isActive", true),
      )
      .collect();
    const now = Date.now();
    for (const device of devices) {
      await ctx.db.patch(device._id, {
        isActive: false,
        deactivatedAt: now,
        deactivatedBy: userId,
      });
    }

    await ctx.db.patch(args.organizationId, { status: "disabled", updatedAt: now });
    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      action: "platform_archive_organization",
      entityType: "organizations",
      entityId: args.organizationId,
      metadata: { deactivatedDevices: devices.length },
    });
    return { archived: true };
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
      createdAt: Date.now(),
    });
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
    if (!gate.isPlatformAdmin) throw new Error("Forbidden");

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
