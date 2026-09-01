/**
 * Super Admin import/export snapshot for one organization.
 * Counts and filenames only — spreadsheet contents are never stored.
 */

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { planCapabilities, remainingProductCreates, type PlanCapabilities } from "./capabilities";
import type { PlanKey, PlanLimits } from "./plans";

type Ctx = QueryCtx | MutationCtx;

const RECENT_LIMIT = 8;

export type ExportFormatCounts = {
  csv: number;
  xlsx: number;
  pdf: number;
  json: number;
  other: number;
};

export type OrgImportJobSummary = {
  id: string;
  fileName: string;
  status: "completed" | "failed";
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errorSummary?: string;
  createdAt: number;
};

export type OrgExportEventSummary = {
  id: string;
  kind: string;
  format: string;
  rowCount: number;
  createdAt: number;
};

export type OrgLimitChangeSummary = {
  createdAt: number;
  products?: number | null;
  users?: number | null;
  branches?: number | null;
  devices?: number | null;
};

export type OrgImportExportSnapshot = {
  capabilities: PlanCapabilities;
  productLimit: number | null;
  productsUsed: number;
  remainingProductCreates: number | null;
  productLimitOverridden: boolean;
  maxImportRows: number;
  importJobs: number;
  failedImports: number;
  createdViaImport: number;
  updatedViaImport: number;
  exportEvents: number;
  exportsByFormat: ExportFormatCounts;
  lastImportAt: number | null;
  lastExportAt: number | null;
  recentJobs: OrgImportJobSummary[];
  recentExports: OrgExportEventSummary[];
  limitChanges: OrgLimitChangeSummary[];
};

export function emptyExportFormatCounts(): ExportFormatCounts {
  return { csv: 0, xlsx: 0, pdf: 0, json: 0, other: 0 };
}

export function countExportFormats(events: Array<{ format: string }>): ExportFormatCounts {
  const counts = emptyExportFormatCounts();
  for (const event of events) {
    const format = event.format.toLowerCase();
    if (format === "csv" || format === "xlsx" || format === "pdf" || format === "json") {
      counts[format] += 1;
    } else {
      counts.other += 1;
    }
  }
  return counts;
}

export function groupRowsByOrganization<T extends { organizationId: Id<"organizations"> }>(
  rows: T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = String(row.organizationId);
    const list = grouped.get(key);
    if (list) list.push(row);
    else grouped.set(key, [row]);
  }
  return grouped;
}

function isLimitOverrideValue(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

export function parseLimitOverrideAuditMetadata(
  metadata: string | undefined,
): Omit<OrgLimitChangeSummary, "createdAt"> | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const next: Omit<OrgLimitChangeSummary, "createdAt"> = {};
    for (const key of ["products", "users", "branches", "devices"] as const) {
      if (!(key in parsed)) continue;
      if (!isLimitOverrideValue(parsed[key])) continue;
      next[key] = parsed[key];
    }
    return next;
  } catch {
    return null;
  }
}

function summarizeJobs(jobs: Doc<"importJobs">[]) {
  return {
    importJobs: jobs.length,
    failedImports: jobs.filter((job) => job.status === "failed").length,
    createdViaImport: jobs.reduce((sum, job) => sum + job.createdCount, 0),
    updatedViaImport: jobs.reduce((sum, job) => sum + job.updatedCount, 0),
    lastImportAt: jobs.reduce((latest, job) => Math.max(latest, job.createdAt), 0) || null,
    recentJobs: [...jobs]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, RECENT_LIMIT)
      .map((job) => ({
        id: job._id,
        fileName: job.fileName,
        status: job.status,
        createdCount: job.createdCount,
        updatedCount: job.updatedCount,
        skippedCount: job.skippedCount,
        failedCount: job.failedCount,
        errorSummary: job.errorSummary,
        createdAt: job.createdAt,
      })),
  };
}

function summarizeExports(events: Doc<"exportEvents">[]) {
  return {
    exportEvents: events.length,
    exportsByFormat: countExportFormats(events),
    lastExportAt: events.reduce((latest, event) => Math.max(latest, event.createdAt), 0) || null,
    recentExports: [...events]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, RECENT_LIMIT)
      .map((event) => ({
        id: event._id,
        kind: event.kind,
        format: event.format,
        rowCount: event.rowCount,
        createdAt: event.createdAt,
      })),
  };
}

export async function loadOrganizationImportExport(
  ctx: Ctx,
  args: {
    organizationId: Id<"organizations">;
    planKey: PlanKey;
    limits: PlanLimits;
    productsUsed: number;
    productLimitOverridden: boolean;
  },
): Promise<OrgImportExportSnapshot> {
  const [jobs, events, auditRows] = await Promise.all([
    ctx.db
      .query("importJobs")
      .withIndex("by_organization_createdAt", (q) => q.eq("organizationId", args.organizationId))
      .collect(),
    ctx.db
      .query("exportEvents")
      .withIndex("by_organization_createdAt", (q) => q.eq("organizationId", args.organizationId))
      .collect(),
    ctx.db
      .query("auditLogs")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .take(40),
  ]);

  const capabilities = planCapabilities(args.planKey, args.limits);
  const jobSummary = summarizeJobs(jobs);
  const exportSummary = summarizeExports(events);
  const limitChanges: OrgLimitChangeSummary[] = [];
  for (const row of auditRows) {
    if (row.action !== "platform_set_limit_overrides") continue;
    const parsed = parseLimitOverrideAuditMetadata(row.metadata);
    if (!parsed) continue;
    limitChanges.push({ createdAt: row.createdAt, ...parsed });
    if (limitChanges.length >= RECENT_LIMIT) break;
  }

  return {
    capabilities,
    productLimit: args.limits.products,
    productsUsed: args.productsUsed,
    remainingProductCreates: remainingProductCreates(args.productsUsed, args.limits.products),
    productLimitOverridden: args.productLimitOverridden,
    maxImportRows: capabilities.maxImportRows,
    ...jobSummary,
    ...exportSummary,
    limitChanges,
  };
}
