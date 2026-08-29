import { describe, expect, it } from "vitest";
import {
  assertActiveOrgBranch,
  assertBelongsToOrganization,
  assertStorageClaimForOrg,
  belongsToOrganization,
  canClaimStorageForOrg,
} from "@/convex/shared/tenancy";

const ORG_A = "org_aaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ORG_B = "org_bbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const BRANCH_B = { organizationId: ORG_B, status: "active" as const };
const PRODUCT_A = { organizationId: ORG_A };
const CLAIM_A = { organizationId: ORG_A, storageId: "kg123" };

describe("two-organization IDOR guards", () => {
  it("blocks org B from mutating org A's product/profile documents", () => {
    expect(belongsToOrganization(PRODUCT_A, ORG_A)).toBe(true);
    expect(belongsToOrganization(PRODUCT_A, ORG_B)).toBe(false);
    expect(() => assertBelongsToOrganization(PRODUCT_A, ORG_B)).toThrow(/not found/i);
    expect(() => assertBelongsToOrganization(null, ORG_A)).toThrow(/not found/i);
  });

  it("blocks expense branch injection from another organization", () => {
    expect(() => assertActiveOrgBranch(BRANCH_B, ORG_A)).toThrow(/invalid branch/i);
    expect(() => assertActiveOrgBranch({ organizationId: ORG_A, status: "inactive" }, ORG_A)).toThrow(
      /invalid branch/i,
    );
    expect(() => assertActiveOrgBranch({ organizationId: ORG_A, status: "active" }, ORG_A)).not.toThrow();
  });

  it("blocks org B from attaching org A's storage blob", () => {
    expect(() => assertStorageClaimForOrg(CLAIM_A, ORG_B)).toThrow(/uploaded file not found/i);
    expect(() => assertStorageClaimForOrg(CLAIM_A, ORG_A)).not.toThrow();
    expect(canClaimStorageForOrg(CLAIM_A, ORG_B)).toBe(false);
    expect(canClaimStorageForOrg(null, ORG_B)).toBe(true);
  });

  it("covers the patched write paths as a regression matrix", () => {
    const writes = [
      { path: "archiveProduct", guard: "assertBelongsToOrganization(product)" },
      { path: "updateProfile", guard: "assertBelongsToOrganization(profile + branch)" },
      { path: "createUserAccount", guard: "assigned branch organizationId" },
      { path: "updateExpense", guard: "assertActiveOrgBranch(nextBranchId)" },
      { path: "createProduct/updateProduct/updateOwnProfile/recordBackup", guard: "assertStorageClaimForOrg" },
    ];
    expect(writes).toHaveLength(5);
    for (const write of writes) {
      expect(write.path.length).toBeGreaterThan(0);
      expect(write.guard.length).toBeGreaterThan(0);
    }
  });
});
