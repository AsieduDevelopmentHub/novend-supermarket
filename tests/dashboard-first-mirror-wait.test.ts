import { describe, expect, it, vi, beforeEach } from "vitest";

const loadCloudPolicy = vi.fn();
const mirrorHasCatalog = vi.fn();

vi.mock("@/lib/offline/cloud-policy", () => ({
  loadCloudPolicy: (...args: unknown[]) => loadCloudPolicy(...args),
}));

vi.mock("@/lib/offline/freshness", () => ({
  getLastSnapshotAt: vi.fn(),
  mirrorHasCatalog: (...args: unknown[]) => mirrorHasCatalog(...args),
}));

vi.mock("@/hooks/use-connectivity", () => ({
  useConnectivity: () => true,
}));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ isAdmin: true, role: "administrator" }),
}));

vi.mock("@/lib/offline/ui-cache", () => ({
  buildLocalDashboardSummary: vi.fn(),
  loadDashboardSummary: vi.fn(),
  saveDashboardSummary: vi.fn(),
}));

vi.mock("@/lib/offline/replica-events", () => ({
  subscribeReplicaChanged: () => () => undefined,
}));

import { shouldWaitForFirstMirror } from "@/hooks/use-dashboard-data";

describe("shouldWaitForFirstMirror", () => {
  beforeEach(() => {
    loadCloudPolicy.mockReset();
    mirrorHasCatalog.mockReset();
  });

  it("waits only on full_sync with an empty fresh replica", async () => {
    loadCloudPolicy.mockResolvedValue({
      shouldUseRealtimeSubscriptions: () => true,
    });
    mirrorHasCatalog.mockResolvedValue(false);
    await expect(
      shouldWaitForFirstMirror({ online: true, lastSnap: null, empty: true }),
    ).resolves.toBe(true);
  });

  it("does not wait in snapshot_only / backup_only / local_only", async () => {
    loadCloudPolicy.mockResolvedValue({
      shouldUseRealtimeSubscriptions: () => false,
    });
    mirrorHasCatalog.mockResolvedValue(false);
    await expect(
      shouldWaitForFirstMirror({ online: true, lastSnap: null, empty: true }),
    ).resolves.toBe(false);
  });

  it("does not wait when the catalog is already mirrored", async () => {
    loadCloudPolicy.mockResolvedValue({
      shouldUseRealtimeSubscriptions: () => true,
    });
    mirrorHasCatalog.mockResolvedValue(true);
    await expect(
      shouldWaitForFirstMirror({ online: true, lastSnap: null, empty: true }),
    ).resolves.toBe(false);
  });

  it("does not wait when a snapshot timestamp already exists", async () => {
    loadCloudPolicy.mockResolvedValue({
      shouldUseRealtimeSubscriptions: () => true,
    });
    mirrorHasCatalog.mockResolvedValue(false);
    await expect(
      shouldWaitForFirstMirror({ online: true, lastSnap: Date.now(), empty: true }),
    ).resolves.toBe(false);
  });
});
