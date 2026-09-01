import { describe, expect, it } from "vitest";
import { formatAuditDetail, humanizeAuditAction } from "../convex/shared/auditDisplay";

describe("audit display — account closure", () => {
  it("labels closure-related actions for platform activity", () => {
    expect(humanizeAuditAction("request_organization_closure")).toBe("Business closure scheduled");
    expect(humanizeAuditAction("finalize_organization_closure")).toBe("Business closure finalized");
    expect(humanizeAuditAction("delete_own_account")).toBe("Staff account deleted (self-service)");
  });

  it("formats closure detail with deadline and reason", () => {
    const detail = formatAuditDetail({
      action: "request_organization_closure",
      entityType: "organizations",
      entityId: "org_1",
      metadata: {
        effectiveAt: Date.parse("2026-10-01T12:00:00.000Z"),
        reason: "cost",
      },
      organizationName: "Demo Shop",
    });
    expect(detail).toContain("Permanent closure");
    expect(detail).toContain("Reason: Cost concerns");
    expect(detail).toContain("Demo Shop");
  });
});
