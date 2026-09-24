/**
 * Platform-owned experience presets (semantic color tokens).
 * Tenants never create or edit these — platform admin only.
 */

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  experienceOverridesValidator,
  experiencePresetStatusValidator,
  experienceRadiusScaleValidator,
} from "./schema";
import { requirePlatformAdmin } from "./shared/permissions";
import { writeAuditLog } from "./shared/audit";
import { sanitizeText, TEXT_LIMITS } from "./shared/validation";
import { bumpEntitlementVersion } from "./shared/entitlementVersion";
import { resolveExperienceTokens } from "./shared/organizationConfig";
import {
  DEFAULT_NOVEND_EXPERIENCE,
  EXPERIENCE_TOKEN_FIELDS,
  assertExperienceContrast,
  validateExperienceTokens,
  validateHexColor,
  type ExperienceRadiusScale,
} from "./shared/experience";

const NOVEND_DEFAULT_KEY = "novend-default";

const experienceTokenArgs = {
  accent: v.string(),
  accentForeground: v.string(),
  sidebarBackground: v.string(),
  sidebarForeground: v.string(),
  sidebarAccent: v.string(),
  sidebarAccentForeground: v.string(),
  focusRing: v.string(),
  success: v.string(),
  warning: v.string(),
  danger: v.string(),
  radiusScale: experienceRadiusScaleValidator,
} as const;

function validateTokensOrThrow(input: {
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
}) {
  const result = validateExperienceTokens(input);
  if (!result.ok) {
    throw new Error(result.errors.join(" "));
  }
  return result.tokens;
}

function sanitizePresetKey(raw: string): string {
  const key = sanitizeText(raw, "Preset key", 64)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!key || !/^[a-z0-9][a-z0-9-]*$/.test(key)) {
    throw new Error("Preset key must be lowercase letters, numbers, and hyphens.");
  }
  return key;
}

/** Ensures the official Novend default preset exists. Idempotent. */
export async function ensureNovendDefaultPreset(
  ctx: MutationCtx,
  createdBy: Id<"users">,
): Promise<Id<"experiencePresets">> {
  const existing = await ctx.db
    .query("experiencePresets")
    .withIndex("by_key", (q) => q.eq("key", NOVEND_DEFAULT_KEY))
    .unique();
  if (existing) return existing._id;

  const now = Date.now();
  const tokens = DEFAULT_NOVEND_EXPERIENCE;
  return await ctx.db.insert("experiencePresets", {
    key: NOVEND_DEFAULT_KEY,
    name: "Novend default",
    status: "active",
    ...tokens,
    createdBy,
    createdAt: now,
    updatedAt: now,
  });
}

export const list = query({
  args: {
    status: v.optional(experiencePresetStatusValidator),
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const rows = args.status
      ? await ctx.db
          .query("experiencePresets")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .collect()
      : await ctx.db.query("experiencePresets").collect();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const get = query({
  args: { presetId: v.id("experiencePresets") },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    return await ctx.db.get(args.presetId);
  },
});

export const seedNovendDefault = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requirePlatformAdmin(ctx);
    return await ensureNovendDefaultPreset(ctx, userId);
  },
});

export const create = mutation({
  args: {
    key: v.string(),
    name: v.string(),
    ...experienceTokenArgs,
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    await ensureNovendDefaultPreset(ctx, userId);

    const key = sanitizePresetKey(args.key);
    const name = sanitizeText(args.name, "Preset name", TEXT_LIMITS.name);
    const clash = await ctx.db
      .query("experiencePresets")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (clash) throw new Error(`Preset key "${key}" already exists.`);

    const tokens = validateTokensOrThrow({
      accent: args.accent,
      accentForeground: args.accentForeground,
      sidebarBackground: args.sidebarBackground,
      sidebarForeground: args.sidebarForeground,
      sidebarAccent: args.sidebarAccent,
      sidebarAccentForeground: args.sidebarAccentForeground,
      focusRing: args.focusRing,
      success: args.success,
      warning: args.warning,
      danger: args.danger,
      radiusScale: args.radiusScale,
    });

    const now = Date.now();
    const id = await ctx.db.insert("experiencePresets", {
      key,
      name,
      status: "active",
      ...tokens,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "platform_experience_preset_create",
      entityType: "experiencePresets",
      entityId: id,
      metadata: { key, name },
    });

    return id;
  },
});

export const update = mutation({
  args: {
    presetId: v.id("experiencePresets"),
    name: v.optional(v.string()),
    accent: v.optional(v.string()),
    accentForeground: v.optional(v.string()),
    sidebarBackground: v.optional(v.string()),
    sidebarForeground: v.optional(v.string()),
    sidebarAccent: v.optional(v.string()),
    sidebarAccentForeground: v.optional(v.string()),
    focusRing: v.optional(v.string()),
    success: v.optional(v.string()),
    warning: v.optional(v.string()),
    danger: v.optional(v.string()),
    radiusScale: v.optional(experienceRadiusScaleValidator),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const preset = await ctx.db.get(args.presetId);
    if (!preset) throw new Error("Experience preset not found.");
    if (preset.status === "archived") {
      throw new Error("Archived presets cannot be edited. Create a new preset instead.");
    }

    const next = {
      accent: args.accent ?? preset.accent,
      accentForeground: args.accentForeground ?? preset.accentForeground,
      sidebarBackground: args.sidebarBackground ?? preset.sidebarBackground,
      sidebarForeground: args.sidebarForeground ?? preset.sidebarForeground,
      sidebarAccent: args.sidebarAccent ?? preset.sidebarAccent,
      sidebarAccentForeground: args.sidebarAccentForeground ?? preset.sidebarAccentForeground,
      focusRing: args.focusRing ?? preset.focusRing,
      success: args.success ?? preset.success,
      warning: args.warning ?? preset.warning,
      danger: args.danger ?? preset.danger,
      radiusScale: args.radiusScale ?? preset.radiusScale,
    };
    const tokens = validateTokensOrThrow(next);
    const name =
      args.name !== undefined
        ? sanitizeText(args.name, "Preset name", TEXT_LIMITS.name)
        : preset.name;

    await ctx.db.patch(args.presetId, {
      name,
      ...tokens,
      updatedAt: Date.now(),
    });

    const changedFields = [
      ...EXPERIENCE_TOKEN_FIELDS.filter((field) => args[field] !== undefined),
      ...(args.name !== undefined ? (["name"] as const) : []),
      ...(args.radiusScale !== undefined ? (["radiusScale"] as const) : []),
    ];

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "platform_experience_preset_update",
      entityType: "experiencePresets",
      entityId: args.presetId,
      metadata: { key: preset.key, changedFields },
    });

    return args.presetId;
  },
});

export const archive = mutation({
  args: { presetId: v.id("experiencePresets") },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const preset = await ctx.db.get(args.presetId);
    if (!preset) throw new Error("Experience preset not found.");
    if (preset.key === NOVEND_DEFAULT_KEY) {
      throw new Error("The Novend default preset cannot be archived.");
    }
    if (preset.status === "archived") return args.presetId;

    await ctx.db.patch(args.presetId, {
      status: "archived",
      updatedAt: Date.now(),
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "platform_experience_preset_archive",
      entityType: "experiencePresets",
      entityId: args.presetId,
      metadata: { key: preset.key, name: preset.name },
    });

    return args.presetId;
  },
});

export const assignToOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
    experiencePresetId: v.union(v.id("experiencePresets"), v.null()),
    experienceOverrides: v.optional(v.union(v.null(), experienceOverridesValidator)),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found.");

    const presetId = args.experiencePresetId ?? undefined;
    if (presetId) {
      const preset = await ctx.db.get(presetId);
      if (!preset) throw new Error("Experience preset not found.");
      if (preset.status === "archived") {
        throw new Error("Cannot assign an archived experience preset.");
      }
    }

    const overridesInput = args.experienceOverrides;
    let experienceOverrides = org.experienceOverrides;
    if (overridesInput === null) {
      experienceOverrides = undefined;
    } else if (overridesInput !== undefined) {
      const cleaned: {
        accent?: string;
        accentForeground?: string;
        sidebarBackground?: string;
        sidebarForeground?: string;
        sidebarAccent?: string;
        sidebarAccentForeground?: string;
      } = {};
      for (const [key, value] of Object.entries(overridesInput) as Array<
        [keyof typeof cleaned, string | undefined]
      >) {
        if (value === undefined || value === "") continue;
        const validated = validateHexColor(value);
        if (!validated.ok) throw new Error(`${key}: ${validated.reason}`);
        cleaned[key] = validated.value;
      }

      const basePreset = presetId
        ? await ctx.db.get(presetId)
        : org.experiencePresetId
          ? await ctx.db.get(org.experiencePresetId)
          : null;
      const resolved = resolveExperienceTokens(basePreset, cleaned);
      assertExperienceContrast(resolved);
      experienceOverrides = Object.keys(cleaned).length > 0 ? cleaned : undefined;
    }

    const now = Date.now();
    await ctx.db.patch(args.organizationId, {
      experiencePresetId: presetId,
      experienceOverrides,
      experienceVersion: (org.experienceVersion ?? 0) + 1,
      updatedAt: now,
    });
    await bumpEntitlementVersion(ctx, args.organizationId);

    await writeAuditLog(ctx, {
      actorId: userId,
      organizationId: args.organizationId,
      action: "platform_experience_assign",
      entityType: "organizations",
      entityId: args.organizationId,
      metadata: {
        experiencePresetId: presetId ?? null,
        hasOverrides: Boolean(experienceOverrides),
        previousPresetId: org.experiencePresetId ?? null,
      },
    });

    return args.organizationId;
  },
});
