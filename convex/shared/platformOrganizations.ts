/** Platform org helpers — commercial KPIs never count test tenants. */

export function isCommercialOrganization(org: { isTestOrganization?: boolean }): boolean {
  return org.isTestOrganization !== true;
}

export type OrganizationStatusCounts = {
  /** Every org row in Convex (includes test). */
  total: number;
  commercialCount: number;
  testCount: number;
  /** Paid / in-good-standing commercial tenants (`status === "active"`). */
  active: number;
  trial: number;
  suspended: number;
  expired: number;
  inactive: number;
};

export function countOrganizationsByCommercialStatus(
  organizations: Array<{ status: string; isTestOrganization?: boolean }>,
): OrganizationStatusCounts {
  const commercial = organizations.filter(isCommercialOrganization);
  const byStatus = (status: string) => commercial.filter((org) => org.status === status).length;
  return {
    total: organizations.length,
    commercialCount: commercial.length,
    testCount: organizations.length - commercial.length,
    active: byStatus("active"),
    trial: byStatus("trial"),
    suspended: byStatus("suspended"),
    expired: byStatus("expired"),
    inactive: commercial.filter(
      (org) => org.status === "inactive" || org.status === "disabled",
    ).length,
  };
}
