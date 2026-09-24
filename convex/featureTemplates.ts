/**
 * Feature entitlement templates and per-organization override assignment.
 * Platform administrator only.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  billingVisibilityValidator,
  featureOverrideEntryValidator,
  featureTemplateStatusValidator,
} from "./schema";
import { featureKeyValidator, FEATURE_KEYS, isFeatureKey } from "./shared/features";
import { requirePlatformAdmin } from "./shared/permissions";
import { writeAuditLog } from "./shared/audit";
import { sanitizeOptionalText, sanitizeText, TEXT_LIMITS } from "./shared/validation";
import { bumpEntitlementVersion } from "./shared/entitlementVersion";

function sanitizeTemplateKey(raw: string): string {
  const key = sanitizeText(raw, "Template key", 64)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!key || !/^[a-z0-9][a-z0-9-]*$/.test(key)) {
    throw new Error("Template key must be lowercase letters, numbers, and hyphens.");
  }
  return key;
}

function normalizeTemplateValues(
  values: Array<{ feature: string; enabled: boolean }>,
): Array<{ feature: (typeof FEATURE_KEYS)[number]; enabled: boolean }> {
  const seen = new Set<string>();
  const normalized: Array<{ feature: (typeof FEATURE_KEYS)[number]; enabled: boolean }> = [];
  for (const entry of values) {
    if (!isFeatureKey(entry.feature)) {
      throw new Error(`Unknown feature key: ${entry.feature}`);
    }
    if (seen.has(entry.feature)) {
      throw new Error(`Duplicate feature in template: ${entry.feature}`);
    }
    seen.add(entry.feature);
    normalized.push({ feature: entry.feature, enabled: entry.enabled });
  }
  return normalized;
}

function normalizeOrgOverrides(
  overrides: Array<{
    feature: string;
    value: "inherit" | "enabled" | "disabled";
  }>,
) {
  const seen = new Set<string>();
  const normalized: Array<{
    feature: (typeof FEATURE_KEYS)[number];
    value: "inherit" | "enabled" | "disabled";
  }> = [];
  for (const entry of overrides) {
    if (!isFeatureKey(entry.feature)) {
      throw new Error(`Unknown feature key: ${entry.feature}`);
    }
    if (seen.has(entry.feature)) {
      throw new Error(`Duplicate feature override: ${entry.feature}`);
    }
    seen.add(entry.feature);
    // Persist only non-inherit rows so removing an override returns to template/plan.
    if (entry.value === "inherit") continue;
    normalized.push({ feature: entry.feature, value: entry.value });
  }
  return normalized;
}

export const list = query({
  args: {
    status: v.optional(featureTemplateStatusValidator),
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const rows = await ctx.db.query("featureTemplates").collect();
    const filtered = args.status ? rows.filter((row) => row.status === args.status) : rows;
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const get = query({
  args: { templateId: v.id("featureTemplates") },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    return await ctx.db.get(args.templateId);
  },
});

export const create = mutation({
  args: {
    key: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    values: v.array(
      v.object({
        feature: featureKeyValidator,
        enabled: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const key = sanitizeTemplateKey(args.key);
    const name = sanitizeText(args.name, "Template name", TEXT_LIMITS.name);
    const description = sanitizeOptionalText(
      args.description,
      "Description",
      TEXT_LIMITS.description,
    );
    const clash = await ctx.db
      .query("featureTemplates")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (clash) throw new Error(`Template key "${key}" already exists.`);

    const values = normalizeTemplateValues(args.values);
    const now = Date.now();
    const id = await ctx.db.insert("featureTemplates", {
      key,
      name,
      description,
      values,
      status: "active",
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "platform_feature_template_create",
      entityType: "featureTemplates",
      entityId: id,
      metadata: { key, name, valueCount: values.length },
    });

    return id;
  },
});

export const update = mutation({
  args: {
    templateId: v.id("featureTemplates"),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    values: v.optional(
      v.array(
        v.object({
          feature: featureKeyValidator,
          enabled: v.boolean(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Feature template not found.");
    if (template.status === "archived") {
      throw new Error("Archived templates cannot be edited.");
    }

    const patch: {
      name?: string;
      description?: string;
      values?: ReturnType<typeof normalizeTemplateValues>;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.name !== undefined) {
      patch.name = sanitizeText(args.name, "Template name", TEXT_LIMITS.name);
    }
    if (args.description !== undefined) {
      patch.description =
        args.description === null
          ? undefined
          : sanitizeOptionalText(args.description, "Description", TEXT_LIMITS.description);
    }
    if (args.values !== undefined) {
      patch.values = normalizeTemplateValues(args.values);
    }

    await ctx.db.patch(args.templateId, patch);

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "platform_feature_template_update",
      entityType: "featureTemplates",
      entityId: args.templateId,
      metadata: { key: template.key },
    });

    return args.templateId;
  },
});

export const archive = mutation({
  args: { templateId: v.id("featureTemplates") },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Feature template not found.");
    if (template.status === "archived") return args.templateId;

    await ctx.db.patch(args.templateId, {
      status: "archived",
      updatedAt: Date.now(),
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "platform_feature_template_archive",
      entityType: "featureTemplates",
      entityId: args.templateId,
      metadata: { key: template.key, name: template.name },
    });

    return args.templateId;
  },
});

export const assignToOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
    featureTemplateId: v.union(v.id("featureTemplates"), v.null()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found.");

    const templateId = args.featureTemplateId ?? undefined;
    if (templateId) {
      const template = await ctx.db.get(templateId);
      if (!template) throw new Error("Feature template not found.");
      if (template.status === "archived") {
        throw new Error("Cannot assign an archived feature template.");
      }
    }

    await ctx.db.patch(args.organizationId, {
      featureTemplateId: templateId,
      featureEntitlementVersion: (org.featureEntitlementVersion ?? 0) + 1,
      updatedAt: Date.now(),
    });
    await bumpEntitlementVersion(ctx, args.organizationId);

    await writeAuditLog(ctx, {
      actorId: userId,
      organizationId: args.organizationId,
      action: "platform_feature_template_assign",
      entityType: "organizations",
      entityId: args.organizationId,
      metadata: {
        featureTemplateId: templateId ?? null,
        previousTemplateId: org.featureTemplateId ?? null,
      },
    });

    return args.organizationId;
  },
});

export const setOrganizationFeatureOverrides = mutation({
  args: {
    organizationId: v.id("organizations"),
    featureOverrides: v.array(featureOverrideEntryValidator),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found.");

    const featureOverrides = normalizeOrgOverrides(args.featureOverrides);
    const previous = org.featureOverrides ?? [];

    await ctx.db.patch(args.organizationId, {
      featureOverrides: featureOverrides.length > 0 ? featureOverrides : undefined,
      featureEntitlementVersion: (org.featureEntitlementVersion ?? 0) + 1,
      updatedAt: Date.now(),
    });
    await bumpEntitlementVersion(ctx, args.organizationId);

    await writeAuditLog(ctx, {
      actorId: userId,
      organizationId: args.organizationId,
      action: "platform_feature_overrides_set",
      entityType: "organizations",
      entityId: args.organizationId,
      metadata: {
        before: previous,
        after: featureOverrides,
      },
    });

    return args.organizationId;
  },
});

export const setOrganizationBillingVisibility = mutation({
  args: {
    organizationId: v.id("organizations"),
    billingVisibility: billingVisibilityValidator,
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found.");

    const previous = org.billingVisibility ?? "visible";
    await ctx.db.patch(args.organizationId, {
      billingVisibility: args.billingVisibility,
      featureEntitlementVersion: (org.featureEntitlementVersion ?? 0) + 1,
      updatedAt: Date.now(),
    });
    await bumpEntitlementVersion(ctx, args.organizationId);

    await writeAuditLog(ctx, {
      actorId: userId,
      organizationId: args.organizationId,
      action: "platform_billing_visibility_set",
      entityType: "organizations",
      entityId: args.organizationId,
      metadata: { before: previous, after: args.billingVisibility },
    });

    return args.organizationId;
  },
});
