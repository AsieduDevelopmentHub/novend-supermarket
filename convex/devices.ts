import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRoleIgnoringLicense, requireSessionIgnoringLicense } from "./shared/permissions";
import { writeAuditLog } from "./shared/audit";
import { assertWithinLimit, resolveLicense } from "./shared/entitlements";
import { sanitizeText, TEXT_LIMITS } from "./shared/validation";

const runtimeValidator = v.union(
  v.literal("desktop"),
  v.literal("web"),
  v.literal("android"),
  v.literal("ios"),
);

/**
 * Registers or refreshes the terminal the current user is signed in on.
 *
 * Runs on every session start. Known devices are refreshed for free; a new
 * device is only accepted while the plan has an activation slot left.
 */
export const registerDevice = mutation({
  args: {
    fingerprint: v.string(),
    name: v.string(),
    platform: v.string(),
    runtime: runtimeValidator,
    appVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organizationId, userId, organization } = await requireSessionIgnoringLicense(ctx);
    const fingerprint = args.fingerprint.trim().slice(0, 128);
    if (!fingerprint) throw new Error("Device identifier is required");

    const now = Date.now();
    const existing = await ctx.db
      .query("devices")
      .withIndex("by_organization_fingerprint", (q) =>
        q.eq("organizationId", organizationId).eq("fingerprint", fingerprint),
      )
      .unique();

    const name = sanitizeText(args.name || "Novend terminal", "Device name", TEXT_LIMITS.name);
    const platform = args.platform.trim().slice(0, 64) || "Unknown";

    if (existing) {
      if (!existing.isActive) {
        // Re-activating counts against the plan again.
        await assertWithinLimit(
          ctx,
          organizationId,
          (await resolveLicense(ctx, organization)).planKey,
          "devices",
        );
      }
      // Refresh auto browser labels when Cap/desktop identity improves; keep admin renames.
      const runtimeChanged = existing.runtime !== args.runtime;
      const browserAutoName = /^(Chrome|Safari|Firefox|Edge|Opera|Browser) on /i.test(
        existing.name,
      );
      await ctx.db.patch(existing._id, {
        userId,
        ...(runtimeChanged || browserAutoName ? { name } : {}),
        platform,
        runtime: args.runtime,
        appVersion: args.appVersion?.slice(0, 32),
        lastSeenAt: now,
        isActive: true,
        deactivatedAt: undefined,
        deactivatedBy: undefined,
      });
      return { deviceId: existing._id, created: false as const };
    }

    const license = await resolveLicense(ctx, organization);
    await assertWithinLimit(ctx, organizationId, license.planKey, "devices");

    const deviceId = await ctx.db.insert("devices", {
      organizationId,
      userId,
      name,
      fingerprint,
      platform,
      runtime: args.runtime,
      appVersion: args.appVersion?.slice(0, 32),
      registeredAt: now,
      lastSeenAt: now,
      isActive: true,
    });

    await writeAuditLog(ctx, {
      organizationId,
      actorId: userId,
      action: "device_registered",
      entityType: "devices",
      entityId: deviceId,
      metadata: { platform, runtime: args.runtime },
    });

    return { deviceId, created: true as const };
  },
});

/** Keeps `lastSeenAt` current without re-running the activation checks. */
export const touchDevice = mutation({
  args: { fingerprint: v.string() },
  handler: async (ctx, args) => {
    const { organizationId } = await requireSessionIgnoringLicense(ctx);
    const device = await ctx.db
      .query("devices")
      .withIndex("by_organization_fingerprint", (q) =>
        q.eq("organizationId", organizationId).eq("fingerprint", args.fingerprint.trim()),
      )
      .unique();
    if (!device || !device.isActive) return;
    await ctx.db.patch(device._id, { lastSeenAt: Date.now() });
  },
});

export const listDevices = query({
  args: {
    /** Marks the caller's own terminal in the list. */
    fingerprint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organizationId, organization, profile } = await requireSessionIgnoringLicense(ctx);
    if (profile.role === "cashier") throw new Error("Forbidden");

    const [devices, license] = await Promise.all([
      ctx.db
        .query("devices")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect(),
      resolveLicense(ctx, organization),
    ]);

    const owners = new Map<string, string>();
    for (const device of devices) {
      if (owners.has(device.userId)) continue;
      const ownerProfile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", device.userId))
        .unique();
      owners.set(device.userId, ownerProfile?.name ?? "Unknown user");
    }

    const active = devices.filter((device) => device.isActive);
    return {
      limit: license.limits.devices,
      activeCount: active.length,
      devices: devices
        .sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.lastSeenAt - a.lastSeenAt)
        .map((device) => ({
          id: device._id,
          name: device.name,
          platform: device.platform,
          runtime: device.runtime,
          appVersion: device.appVersion ?? null,
          registeredAt: device.registeredAt,
          lastSeenAt: device.lastSeenAt,
          isActive: device.isActive,
          isCurrent: args.fingerprint ? device.fingerprint === args.fingerprint.trim() : false,
          userName: owners.get(device.userId) ?? "Unknown user",
        })),
    };
  },
});

export const renameDevice = mutation({
  args: { deviceId: v.id("devices"), name: v.string() },
  handler: async (ctx, args) => {
    const { organizationId, userId } = await requireRoleIgnoringLicense(ctx, [
      "administrator",
      "manager",
    ]);
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.organizationId !== organizationId) throw new Error("Not found");
    const name = sanitizeText(args.name, "Device name", TEXT_LIMITS.name);
    await ctx.db.patch(device._id, { name });
    await writeAuditLog(ctx, {
      organizationId,
      actorId: userId,
      action: "device_renamed",
      entityType: "devices",
      entityId: device._id,
      metadata: { name },
    });
  },
});

/**
 * Frees an activation slot. Administrators only — deactivating a terminal stops
 * that machine from registering again until someone signs in on it.
 */
export const deactivateDevice = mutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const { organizationId, userId } = await requireRoleIgnoringLicense(ctx, ["administrator"]);
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.organizationId !== organizationId) throw new Error("Not found");
    if (!device.isActive) return;
    await ctx.db.patch(device._id, {
      isActive: false,
      deactivatedAt: Date.now(),
      deactivatedBy: userId,
    });
    await writeAuditLog(ctx, {
      organizationId,
      actorId: userId,
      action: "device_deactivated",
      entityType: "devices",
      entityId: device._id,
    });
  },
});
