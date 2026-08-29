/**
 * Pure tenant-isolation predicates. Convex mutations call these after db.get.
 * Tests exercise two-organization cases without a live deployment.
 */

export function belongsToOrganization(
  doc: { organizationId: string } | null | undefined,
  organizationId: string,
): boolean {
  return Boolean(doc && doc.organizationId === organizationId);
}

export function assertBelongsToOrganization(
  doc: { organizationId: string } | null | undefined,
  organizationId: string,
): asserts doc is { organizationId: string } {
  if (!belongsToOrganization(doc, organizationId)) {
    throw new Error("Not found");
  }
}

export function assertActiveOrgBranch(
  branch: { organizationId: string; status: string } | null | undefined,
  organizationId: string,
): asserts branch is { organizationId: string; status: string } {
  if (!branch || branch.status !== "active" || branch.organizationId !== organizationId) {
    throw new Error("Invalid branch");
  }
}

export type StorageClaimRecord = {
  organizationId: string;
  storageId?: string;
};

/** A blob may be attached only after it was claimed by the same organization. */
export function assertStorageClaimForOrg(
  claim: StorageClaimRecord | null | undefined,
  organizationId: string,
): asserts claim is StorageClaimRecord & { storageId: string } {
  if (!claim || !claim.storageId || claim.organizationId !== organizationId) {
    throw new Error("Uploaded file not found");
  }
}

export function canClaimStorageForOrg(
  existing: StorageClaimRecord | null | undefined,
  organizationId: string,
): boolean {
  if (!existing) return true;
  return existing.organizationId === organizationId;
}
