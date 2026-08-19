import {
  createAccount,
  getAuthUserId,
  modifyAccountCredentials,
} from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { getPlatformAdmin, requirePlatformAdmin } from "./shared/permissions";
import { sanitizeText, TEXT_LIMITS } from "./shared/validation";
import { writeAuditLog } from "./shared/audit";
import { DEFAULT_BRANCH_CODE, DEFAULT_BRANCH_NAME } from "./shared/defaultBranch";

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || "business";
}

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
    const [organizations, profiles, branches, sales] = await Promise.all([
      ctx.db.query("organizations").collect(),
      ctx.db.query("profiles").collect(),
      ctx.db.query("branches").collect(),
      ctx.db.query("sales").collect(),
    ]);

    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const recentSales = sales.filter((sale) => sale.completedAt >= dayAgo);

    return {
      organizationCount: organizations.length,
      activeOrganizations: organizations.filter((org) => org.status === "active").length,
      suspendedOrganizations: organizations.filter((org) => org.status === "suspended").length,
      inactiveOrganizations: organizations.filter((org) => org.status === "inactive").length,
      userCount: profiles.length,
      branchCount: branches.length,
      saleCount: sales.length,
      salesLast24h: recentSales.length,
      recentOrganizations: organizations
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 8)
        .map((org) => ({
          id: org._id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          plan: org.plan ?? "standard",
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
    const profiles = await ctx.db.query("profiles").collect();
    const sales = await ctx.db.query("sales").collect();
    return orgs
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((org) => {
        const staff = profiles.filter((p) => p.organizationId === org._id);
        const orgSales = sales.filter((s) => s.organizationId === org._id);
        return {
          id: org._id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          plan: org.plan ?? "standard",
          currency: org.currency,
          createdAt: org.createdAt,
          userCount: staff.length,
          saleCount: orgSales.length,
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

    const [profiles, branches, products, sales, wholesale, suppliers] = await Promise.all([
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

    return {
      id: org._id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      plan: org.plan ?? "standard",
      currency: org.currency,
      timezone: org.timezone ?? null,
      taxId: org.taxId ?? business.taxId ?? null,
      createdAt: org.createdAt,
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
        productCount: products.filter((p) => p.status !== "archived").length,
        supplierCount: suppliers.length,
        saleCount: sales.length,
        saleCount30d: recentSales.length,
        revenueAll,
        revenue30d,
        lastSaleAt: lastSaleAt || null,
        wholesaleUnits,
        wholesaleValue,
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
    };
  },
});

export const setOrganizationStatus = mutation({
  args: {
    organizationId: v.id("organizations"),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("suspended")),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found");
    await ctx.db.patch(args.organizationId, { status: args.status });
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

export const setOrganizationPlan = mutation({
  args: {
    organizationId: v.id("organizations"),
    plan: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found");
    const plan = sanitizeText(args.plan, "Plan", 40);
    await ctx.db.patch(args.organizationId, { plan });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "platform_set_org_plan",
      entityType: "organizations",
      entityId: args.organizationId,
      metadata: { plan },
    });
    return args.organizationId;
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
    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
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
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const name = sanitizeText(args.name, "Business name", TEXT_LIMITS.name);
    const currency = (args.currency?.trim().toUpperCase() || "GHS").slice(0, 8);
    let slug = slugify(name);
    const clash = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    const organizationId = await ctx.db.insert("organizations", {
      name,
      slug,
      status: "active",
      ownerUserId: userId,
      currency,
      plan: "standard",
      createdAt: now,
    });
    const branchId = await ctx.db.insert("branches", {
      organizationId,
      name: DEFAULT_BRANCH_NAME,
      code: DEFAULT_BRANCH_CODE,
      address: args.address,
      phone: args.phone,
      status: "active",
      createdAt: now,
    });
    await ctx.db.insert("settings", {
      organizationId,
      key: "business.profile",
      value: JSON.stringify({
        tradeName: name,
        legalName: name,
        address: args.address ?? "",
        phone: args.phone ?? "",
        email: "",
        taxId: "",
      }),
    });
    await ctx.db.insert("settings", {
      organizationId,
      key: "receipt.template",
      value: JSON.stringify({
        paperWidthMm: 80,
        showLogo: false,
        headerText: "",
        footerText: "Goods sold are not returnable without receipt",
        thankYouLine: "Thank you for your business",
        showCashier: true,
        showCustomer: true,
        showPaymentMethod: true,
        showSku: false,
      }),
    });
    await ctx.db.insert("settings", {
      organizationId,
      key: "pos.preferences",
      value: JSON.stringify({ autoPrintReceipt: false, receiptPrintMode: "manual" }),
    });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "platform_create_organization",
      entityType: "organizations",
      entityId: organizationId,
    });
    return { organizationId, branchId };
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
    if (!args.newPassword || args.newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    const email = await ctx.runQuery(api.platform.ownerEmail, {
      organizationId: args.organizationId,
    });
    if (!email) throw new Error("Organization owner email not found");
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: email, secret: args.newPassword },
    });
    return { ok: true as const };
  },
});

type GithubReleaseAsset = {
  name: string;
  size: number;
  content_type: string;
  browser_download_url: string;
  download_count: number;
};

type GithubRelease = {
  id: number;
  tag_name: string;
  name: string | null;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
  published_at: string | null;
  created_at: string;
  body: string | null;
  assets: GithubReleaseAsset[];
};

export const listDesktopReleases = action({
  args: {},
  handler: async (ctx) => {
    const gate = await ctx.runQuery(api.platform.me, {});
    if (!gate.isPlatformAdmin) throw new Error("Forbidden");

    const repo =
      process.env.GITHUB_REPOSITORY ??
      process.env.NOVEND_GITHUB_REPO ??
      "AsieduDevelopmentHub/novend-pos";
    const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? process.env.GITHUB_RELEASES_TOKEN;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "novend-pos-platform",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=20`, {
      headers,
    });

    if (!response.ok) {
      const detail = await response.text();
      return {
        ok: false as const,
        repo,
        status: response.status,
        message:
          response.status === 404
            ? "GitHub returned 404. For a private repo, set GITHUB_TOKEN on the Convex deployment."
            : `GitHub releases request failed (${response.status}). ${detail.slice(0, 180)}`,
        releases: [],
      };
    }

    const payload = (await response.json()) as GithubRelease[];
    return {
      ok: true as const,
      repo,
      message: null,
      releases: payload
        .filter((release) => !release.draft)
        .map((release) => ({
          id: release.id,
          tag: release.tag_name,
          title: release.name || release.tag_name,
          prerelease: release.prerelease,
          htmlUrl: release.html_url,
          publishedAt: release.published_at ?? release.created_at,
          notes: release.body,
          assets: release.assets.map((asset) => ({
            name: asset.name,
            size: asset.size,
            contentType: asset.content_type,
            url: asset.browser_download_url,
            downloadCount: asset.download_count,
          })),
        })),
    };
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
