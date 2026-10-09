/**
 * Plan-derived import/export capabilities.
 *
 * This is the only place UI and Convex should consult for format access.
 * Do not scatter `if (plan === "pro")` in screens. Limits and prices stay in
 * `plans.ts`; this module only derives capabilities from that catalog.
 */

import {
  PRO_CAPABILITY_MIN_SORT_ORDER,
  resolvePlan,
  type PlanKey,
  type PlanLimits,
} from "./plans";

/** Hard cap per job so unlimited plans cannot freeze a terminal. */
export const IMPORT_SAFETY_MAX_ROWS = 10_000;

/** Spreadsheet uploads larger than this are rejected before parse. */
export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Client PDFs stay readable; larger sets use CSV/XLSX. */
export const EXPORT_PDF_MAX_ROWS = 500;

export type PlanCapabilities = {
  canImportProducts: boolean;
  canExportReports: boolean;
  canExportCsv: boolean;
  canExportJson: boolean;
  canExportXlsx: boolean;
  canExportPdf: boolean;
  canAdvancedAnalytics: boolean;
  /** Salary, commission, and staff payroll records — Pro rank and above. */
  canManageStaffCompensation: boolean;
  /** Customer-facing second screen — Pro rank and above. */
  canUseCustomerDisplay: boolean;
  /** Per-file row cap derived from the product limit, never a separate price. */
  maxImportRows: number;
};

function hasAdvancedReporting(planKey: PlanKey): boolean {
  return resolvePlan(planKey).sortOrder >= PRO_CAPABILITY_MIN_SORT_ORDER;
}

/** Import row cap from the (possibly overridden) product limit. */
export function derivedMaxImportRows(productLimit: number | null): number {
  if (productLimit === null) return IMPORT_SAFETY_MAX_ROWS;
  return Math.min(productLimit, IMPORT_SAFETY_MAX_ROWS);
}

/**
 * Capabilities for a resolved plan. Pass `limits` when Super Admin overrides
 * or Enterprise backup quotas are already applied.
 */
export function planCapabilities(planKey: PlanKey, limits?: PlanLimits): PlanCapabilities {
  const plan = resolvePlan(planKey);
  const effective = limits ?? plan.limits;
  const advanced = hasAdvancedReporting(plan.key);
  return {
    canImportProducts: true,
    canExportReports: true,
    canExportCsv: true,
    canExportJson: true,
    canExportXlsx: advanced,
    canExportPdf: advanced,
    canAdvancedAnalytics: advanced,
    canManageStaffCompensation: advanced,
    canUseCustomerDisplay: advanced,
    maxImportRows: derivedMaxImportRows(effective.products),
  };
}

export function capabilityDeniedMessage(
  capability: keyof PlanCapabilities,
  planName: string,
): string {
  switch (capability) {
    case "canImportProducts":
      return `Product import is not available on the ${planName} plan.`;
    case "canExportXlsx":
      return `Excel export is available on Pro and above. Upgrade from ${planName} to continue.`;
    case "canExportPdf":
      return `PDF export is available on Pro and above. Upgrade from ${planName} to continue.`;
    case "canAdvancedAnalytics":
      return `Advanced analytics exports are available on Pro and above.`;
    case "canManageStaffCompensation":
      return `Staff salary and commission are available on Pro and above. Upgrade from ${planName} to continue.`;
    case "canUseCustomerDisplay":
      return `Customer display is available on Pro and above. Upgrade from ${planName} to continue.`;
    case "canExportReports":
    case "canExportCsv":
    case "canExportJson":
      return `This export is not available on the ${planName} plan.`;
    case "maxImportRows":
      return `This file exceeds the import row limit on ${planName}.`;
  }
}

export function remainingProductCreates(
  usedProducts: number,
  productLimit: number | null,
): number | null {
  if (productLimit === null) return null;
  return Math.max(0, productLimit - usedProducts);
}
