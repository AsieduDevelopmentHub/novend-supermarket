/**
 * Default experience/feature/plan policies for newly provisioned organizations.
 * Existing orgs keep their snapshot unless bulk-applied explicitly.
 */

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  provisioningPolicyStatusValidator,
  sellablePlanKeyValidator,
} from "./schema";
import { requirePlatformAdmin } from "./shared/permissions";
import { writeAuditLog } from "./shared/audit";
import { sanitizeText, TEXT_LIMITS } from "./shared/validation";
import { bumpEntitlementVersion } from "./shared/entitlementVersion";
import { ensureNovendDefaultPreset } from "./experiencePresets";

/**
 * Active and scheduled policies must not share the same effectiveFrom.
 * Multiple active rows with distinct effectiveFrom are allowed — the latest
 * applicable wins at provision time.
 */
async function assertNoOverlappingSchedule(
  ctx: MutationCtx,
  args: {
    effectiveFrom: number;
    status: "scheduled" | "active" | "retired";
    excludeId?: Id<"organizationProvisioningPolicies">;
  },
) {
  if (args.status === "retired") return;

  const candidates = await ctx.db.query("organizationProvisioningPolicies").collect();
  const conflict = candidates.find(
    (row) =>
      row._id !== args.excludeId &&
      row.status !== "retired" &&
      row.effectiveFrom === args.effectiveFrom,
  );
  if (conflict) {
    throw new Error(
      `Another ${conflict.status} policy already uses effectiveFrom ${new Date(args.effectiveFrom).toISOString()}.`,
    );
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx, "entitlements.write");
    const rows = await ctx.db.query("organizationProvisioningPolicies").collect();
    return rows.sort((a, b) => b.effectiveFrom - a.effectiveFrom);
  },
});

export const get = query({
  args: { policyId: v.id("organizationProvisioningPolicies") },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx, "entitlements.write");
    return await ctx.db.get(args.policyId);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    status: v.optional(provisioningPolicyStatusValidator),
    effectiveFrom: v.number(),
    experiencePresetId: v.optional(v.id("experiencePresets")),
    featureTemplateId: v.optional(v.id("featureTemplates")),
    publicPlanKey: v.optional(sellablePlanKeyValidator),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx, "entitlements.write");
    const name = sanitizeText(args.name, "Policy name", TEXT_LIMITS.name);
    const status = args.status ?? "scheduled";
    if (status === "retired") {
      throw new Error("Create the policy as scheduled or active, then retire it later.");
    }

    let experiencePresetId = args.experiencePresetId;
    if (!experiencePresetId) {
      experiencePresetId = await ensureNovendDefaultPreset(ctx, userId);
    } else {
      const preset = await ctx.db.get(experiencePresetId);
      if (!preset) throw new Error("Experience preset not found.");
      if (preset.status === "archived") {
        throw new Error("Cannot use an archived experience preset in a policy.");
      }
    }

    if (args.featureTemplateId) {
      const template = await ctx.db.get(args.featureTemplateId);
      if (!template) throw new Error("Feature template not found.");
      if (template.status === "archived") {
        throw new Error("Cannot use an archived feature template in a policy.");
      }
    }

    await assertNoOverlappingSchedule(ctx, {
      effectiveFrom: args.effectiveFrom,
      status,
    });

    const now = Date.now();
    const id = await ctx.db.insert("organizationProvisioningPolicies", {
      name,
      status,
      effectiveFrom: args.effectiveFrom,
      experiencePresetId,
      featureTemplateId: args.featureTemplateId,
      publicPlanKey: args.publicPlanKey,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "platform_provisioning_policy_create",
      entityType: "organizationProvisioningPolicies",
      entityId: id,
      metadata: {
        name,
        status,
        effectiveFrom: args.effectiveFrom,
        experiencePresetId,
        featureTemplateId: args.featureTemplateId ?? null,
        publicPlanKey: args.publicPlanKey ?? null,
      },
    });

    return id;
  },
});

export const update = mutation({
  args: {
    policyId: v.id("organizationProvisioningPolicies"),
    name: v.optional(v.string()),
    status: v.optional(provisioningPolicyStatusValidator),
    effectiveFrom: v.optional(v.number()),
    experiencePresetId: v.optional(v.id("experiencePresets")),
    featureTemplateId: v.optional(v.union(v.id("featureTemplates"), v.null())),
    publicPlanKey: v.optional(v.union(sellablePlanKeyValidator, v.null())),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx, "entitlements.write");
    const policy = await ctx.db.get(args.policyId);
    if (!policy) throw new Error("Provisioning policy not found.");

    const status = args.status ?? policy.status;
    const effectiveFrom = args.effectiveFrom ?? policy.effectiveFrom;

    if (args.experiencePresetId) {
      const preset = await ctx.db.get(args.experiencePresetId);
      if (!preset) throw new Error("Experience preset not found.");
      if (preset.status === "archived") {
        throw new Error("Cannot use an archived experience preset in a policy.");
      }
    }
    if (args.featureTemplateId) {
      const template = await ctx.db.get(args.featureTemplateId);
      if (!template) throw new Error("Feature template not found.");
      if (template.status === "archived") {
        throw new Error("Cannot use an archived feature template in a policy.");
      }
    }

    await assertNoOverlappingSchedule(ctx, {
      effectiveFrom,
      status,
      excludeId: args.policyId,
    });

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      patch.name = sanitizeText(args.name, "Policy name", TEXT_LIMITS.name);
    }
    if (args.status !== undefined) patch.status = args.status;
    if (args.effectiveFrom !== undefined) patch.effectiveFrom = args.effectiveFrom;
    if (args.experiencePresetId !== undefined) {
      patch.experiencePresetId = args.experiencePresetId;
    }
    if (args.featureTemplateId !== undefined) {
      patch.featureTemplateId =
        args.featureTemplateId === null ? undefined : args.featureTemplateId;
    }
    if (args.publicPlanKey !== undefined) {
      patch.publicPlanKey = args.publicPlanKey === null ? undefined : args.publicPlanKey;
    }

    await ctx.db.patch(args.policyId, patch);

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "platform_provisioning_policy_update",
      entityType: "organizationProvisioningPolicies",
      entityId: args.policyId,
      metadata: {
        name: patch.name ?? policy.name,
        status,
        effectiveFrom,
      },
    });

    return args.policyId;
  },
});

/**
 * Copy this policy's preset/template onto explicitly selected organizations.
 * Does not change the organization's planKey — only experience + feature assignment.
 */
export const bulkApplyToOrganizations = mutation({
  args: {
    policyId: v.id("organizationProvisioningPolicies"),
    organizationIds: v.array(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx, "entitlements.write");
    const policy = await ctx.db.get(args.policyId);
    if (!policy) throw new Error("Provisioning policy not found.");

    const uniqueIds = [...new Set(args.organizationIds)];
    if (uniqueIds.length === 0) {
      throw new Error("Select at least one organization.");
    }
    if (uniqueIds.length > 200) {
      throw new Error("Bulk apply is limited to 200 organizations per request.");
    }

    const preset = await ctx.db.get(policy.experiencePresetId);
    if (!preset || preset.status === "archived") {
      throw new Error("Policy experience preset is missing or archived.");
    }
    if (policy.featureTemplateId) {
      const template = await ctx.db.get(policy.featureTemplateId);
      if (!template || template.status === "archived") {
        throw new Error("Policy feature template is missing or archived.");
      }
    }

    const now = Date.now();
    let applied = 0;
    const missing: string[] = [];

    for (const organizationId of uniqueIds) {
      const org = await ctx.db.get(organizationId);
      if (!org) {
        missing.push(String(organizationId));
        continue;
      }

      await ctx.db.patch(organizationId, {
        experiencePresetId: policy.experiencePresetId,
        featureTemplateId: policy.featureTemplateId,
        experienceVersion: (org.experienceVersion ?? 0) + 1,
        featureEntitlementVersion: (org.featureEntitlementVersion ?? 0) + 1,
        updatedAt: now,
      });
      await bumpEntitlementVersion(ctx, organizationId);
      applied += 1;
    }

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "platform_provisioning_policy_bulk_apply",
      entityType: "organizationProvisioningPolicies",
      entityId: args.policyId,
      metadata: {
        policyName: policy.name,
        requested: uniqueIds.length,
        applied,
        missing,
        experiencePresetId: policy.experiencePresetId,
        featureTemplateId: policy.featureTemplateId ?? null,
      },
    });

    return { applied, missing };
  },
});
