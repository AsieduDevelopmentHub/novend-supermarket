import { describe, expect, it } from "vitest";
import { offlineReplicaDbName, shouldDeleteOfflineReplicaOnLogout } from "@/lib/offline/db";

describe("logout offline replica cleanup policy", () => {
  it("names org and org+user replicas predictably", () => {
    expect(offlineReplicaDbName("orgA")).toBe("novend-offline-orgA");
    expect(offlineReplicaDbName("orgA", "user1")).toBe("novend-offline-orgA-user1");
  });

  it("deletes only the bound organization's replicas", () => {
    const org = "org_bound";
    expect(shouldDeleteOfflineReplicaOnLogout("novend-offline-org_bound", org)).toBe(true);
    expect(shouldDeleteOfflineReplicaOnLogout("novend-offline-org_bound-user1", org)).toBe(true);
    expect(shouldDeleteOfflineReplicaOnLogout("novend-offline-org_other", org)).toBe(false);
    expect(shouldDeleteOfflineReplicaOnLogout("novend-offline-org_other-user9", org)).toBe(false);
  });

  it("never deletes platform Super Admin replicas or unrelated DBs", () => {
    const org = "org_bound";
    expect(shouldDeleteOfflineReplicaOnLogout("novend-offline-platform-admin1", org)).toBe(false);
    expect(shouldDeleteOfflineReplicaOnLogout("something-else", org)).toBe(false);
    expect(shouldDeleteOfflineReplicaOnLogout("novend-offline-org_bound", null)).toBe(false);
  });

  it("does not treat another org id as a substring match", () => {
    // org ids are opaque strings; still refuse loose includes-style matching.
    expect(shouldDeleteOfflineReplicaOnLogout("novend-offline-org_bound_extra", "org_bound")).toBe(
      false,
    );
  });
});
