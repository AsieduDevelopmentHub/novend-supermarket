import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { canManageCatalog, requireRole } from "./shared/permissions";
import { resolveLicense } from "./shared/entitlements";
import { planCapabilities, capabilityDeniedMessage } from "./shared/capabilities";
import { sanitizeText, TEXT_LIMITS } from "./shared/validation";
import { writeAuditLog } from "./shared/audit";
import {
  bumpOrgExportEventCount,
  bumpOrgImportJobStats,
} from "./shared/organizationStats";

const FORMAT = v.union(v.literal("csv"), v.literal("xlsx"), v.literal("pdf"), v.literal("json"));

async function requireCatalogManager(ctx: Parameters<typeof requireRole>[0]) {
  const session = await requireRole(ctx, ["administrator", "manager"]);
  if (!canManageCatalog(session.profile)) throw new Error("Forbidden");
  return session;
}

export const listJobs = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireCatalogManager(ctx);
    const rows = await ctx.db
      .query("importJobs")
      .withIndex("by_organization_createdAt", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .take(25);
    return rows.map((row) => ({
      id: row._id,
      fileName: row.fileName,
      status: row.status,
      createdCount: row.createdCount,
      updatedCount: row.updatedCount,
      skippedCount: row.skippedCount,
      failedCount: row.failedCount,
      errorSummary: row.errorSummary,
      createdAt: row.createdAt,
    }));
  },
});

export const recordJob = mutation({
  args: {
    fileName: v.string(),
    status: v.union(v.literal("completed"), v.literal("failed")),
    createdCount: v.number(),
    updatedCount: v.number(),
    skippedCount: v.number(),
    failedCount: v.number(),
    errorSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId, organization } = await requireCatalogManager(ctx);
    const license = await resolveLicense(ctx, organization);
    const caps = planCapabilities(license.planKey, license.limits);
    if (!caps.canImportProducts) {
      throw new Error(capabilityDeniedMessage("canImportProducts", license.plan.name));
    }
    const now = Date.now();
    const fileName = sanitizeText(args.fileName, "File name", TEXT_LIMITS.name);
    const id = await ctx.db.insert("importJobs", {
      organizationId,
      actorId: userId,
      kind: "products",
      fileName,
      status: args.status,
      createdCount: Math.max(0, Math.floor(args.createdCount)),
      updatedCount: Math.max(0, Math.floor(args.updatedCount)),
      skippedCount: Math.max(0, Math.floor(args.skippedCount)),
      failedCount: Math.max(0, Math.floor(args.failedCount)),
      errorSummary: args.errorSummary
        ? sanitizeText(args.errorSummary, "Summary", TEXT_LIMITS.description)
        : undefined,
      createdAt: now,
      completedAt: now,
    });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "import_products",
      entityType: "importJobs",
      entityId: id,
      metadata: { status: args.status, createdCount: args.createdCount },
    });
    await bumpOrgImportJobStats(ctx, organizationId, { failed: args.status === "failed" });
    return id;
  },
});

export const listMappings = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireCatalogManager(ctx);
    const rows = await ctx.db
      .query("importMappings")
      .withIndex("by_organization_kind", (q) =>
        q.eq("organizationId", organizationId).eq("kind", "products"),
      )
      .collect();
    return rows
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((row) => ({
        id: row._id,
        name: row.name,
        mappingJson: row.mappingJson,
        updatedAt: row.updatedAt,
      }));
  },
});

export const saveMapping = mutation({
  args: {
    name: v.string(),
    mappingJson: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireCatalogManager(ctx);
    if (args.mappingJson.length > 8_000) throw new Error("Mapping is too large to save.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(args.mappingJson);
    } catch {
      throw new Error("Mapping could not be saved.");
    }
    if (!parsed || typeof parsed !== "object") throw new Error("Mapping could not be saved.");
    const name = sanitizeText(args.name, "Template name", TEXT_LIMITS.name);
    const existing = await ctx.db
      .query("importMappings")
      .withIndex("by_organization_kind", (q) =>
        q.eq("organizationId", organizationId).eq("kind", "products"),
      )
      .collect();
    const clash = existing.find((row) => row.name.toLowerCase() === name.toLowerCase());
    const now = Date.now();
    if (clash) {
      await ctx.db.patch(clash._id, { mappingJson: args.mappingJson, updatedAt: now });
      return clash._id;
    }
    const id = await ctx.db.insert("importMappings", {
      organizationId,
      kind: "products",
      name,
      mappingJson: args.mappingJson,
      createdAt: now,
      updatedAt: now,
    });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "save_import_mapping",
      entityType: "importMappings",
      entityId: id,
    });
    return id;
  },
});

export const recordExport = mutation({
  args: {
    kind: v.string(),
    format: FORMAT,
    rowCount: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId, organization } = await requireCatalogManager(ctx);
    const license = await resolveLicense(ctx, organization);
    const caps = planCapabilities(license.planKey, license.limits);
    if (args.format === "xlsx" && !caps.canExportXlsx) {
      throw new Error(capabilityDeniedMessage("canExportXlsx", license.plan.name));
    }
    if (args.format === "pdf" && !caps.canExportPdf) {
      throw new Error(capabilityDeniedMessage("canExportPdf", license.plan.name));
    }
    if (args.format === "csv" && !caps.canExportCsv) {
      throw new Error(capabilityDeniedMessage("canExportCsv", license.plan.name));
    }
    if (args.format === "json" && !caps.canExportJson) {
      throw new Error(capabilityDeniedMessage("canExportJson", license.plan.name));
    }
    const kind = sanitizeText(args.kind, "Export", TEXT_LIMITS.code);
    await ctx.db.insert("exportEvents", {
      organizationId,
      actorId: userId,
      kind,
      format: args.format,
      rowCount: Math.max(0, Math.floor(args.rowCount)),
      createdAt: Date.now(),
    });
    await bumpOrgExportEventCount(ctx, organizationId);
  },
});
