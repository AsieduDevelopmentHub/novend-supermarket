import { describe, expect, it } from "vitest";
import {
  deriveAccess,
  OFFLINE_LICENSE_TTL_MS,
  type LicenseSnapshot,
} from "@/convex/shared/licensing";
import {
  FIRST_ACTIVATION_REQUIRED,
  LICENSE_RECOVERY_REQUIRED,
  resolveOfflineLicenseState,
} from "@/lib/offline/license";

const NOW = Date.UTC(2026, 8, 23);
const DAY = 24 * 60 * 60 * 1000;

function snapshot(overrides: Partial<LicenseSnapshot> = {}): LicenseSnapshot {
  const subscription = {
    status: "active" as const,
    isLifetime: false,
    expiresAt: NOW + 10 * DAY,
  };
  return {
    organizationId: "org_1",
    organizationName: "Test Shop",
    planKey: "pro",
    planName: "Pro",
    organizationStatus: "active",
    cloudMode: "full_sync",
    entitlementVersion: 2,
    allowedCloudModes: ["full_sync", "backup_only", "local_only"],
    cloudBackupEnabled: true,
    remoteMonitoringEnabled: true,
    subscription,
    access: deriveAccess("active", subscription, NOW),
    limits: {
      products: 5000,
      users: 15,
      branches: 5,
      devices: 15,
      backupBytes: 500_000_000,
    },
    features: [],
    issuedAt: NOW - DAY,
    ...overrides,
  };
}

function resolve(
  raw: string | null,
  options: { activatedBefore?: boolean; organizationId?: string | null } = {},
) {
  return resolveOfflineLicenseState({
    raw,
    activatedBefore: options.activatedBefore ?? false,
    establishedOrganizationId: options.organizationId,
    now: NOW,
  });
}

describe("offline licence state machine", () => {
  it("requires activation on a first-time installation", () => {
    const state = resolve(null);
    expect(state.kind).toBe("first_activation_required");
    expect(state.access.canWrite).toBe(false);
    expect(state.access.reason).toBe(FIRST_ACTIVATION_REQUIRED);
  });

  it("enters recovery when an activated installation loses its cache", () => {
    const state = resolve(null, { activatedBefore: true });
    expect(state.kind).toBe("recovery_required");
    expect(state.access.canWrite).toBe(false);
    expect(state.access.reason).toBe(LICENSE_RECOVERY_REQUIRED);
  });

  it("recognizes an established organization even before the marker migration", () => {
    expect(resolve(null, { organizationId: "org_1" }).kind).toBe("recovery_required");
  });

  it.each(["{broken", "{}", JSON.stringify({ organizationId: "org_1" })])(
    "treats a corrupt cache as recovery state: %s",
    (raw) => {
      const state = resolve(raw);
      expect(state.kind).toBe("recovery_required");
      expect(state.access.canWrite).toBe(false);
    },
  );

  it("rejects a cached licence bound to another organization", () => {
    const state = resolve(JSON.stringify(snapshot()), { organizationId: "org_2" });
    expect(state.kind).toBe("recovery_required");
    expect(state.access.canWrite).toBe(false);
  });

  it("allows a recent validated cache", () => {
    const state = resolve(JSON.stringify(snapshot()));
    expect(state.kind).toBe("valid");
    expect(state.access.canWrite).toBe(true);
  });

  it.each(["full_sync", "backup_only"] as const)(
    "makes an expired %s cache read-only",
    (cloudMode) => {
      const state = resolve(
        JSON.stringify(
          snapshot({
            cloudMode,
            issuedAt: NOW - OFFLINE_LICENSE_TTL_MS - DAY,
          }),
        ),
      );
      expect(state.kind).toBe("stale");
      expect(state.access.canWrite).toBe(false);
      expect(state.access.reason).toMatch(/reconnect/i);
    },
  );

  it("keeps an activated local-only organization writable without periodic checks", () => {
    const state = resolve(
      JSON.stringify(
        snapshot({
          cloudMode: "local_only",
          issuedAt: NOW - OFFLINE_LICENSE_TTL_MS - 365 * DAY,
        }),
      ),
    );
    expect(state.kind).toBe("perpetual");
    expect(state.access.canWrite).toBe(true);
    expect(state.access.stale).toBe(false);
  });

  it("keeps an activated lifetime licence writable without periodic checks", () => {
    const lifetime = {
      status: "active" as const,
      isLifetime: true,
      expiresAt: NOW - 365 * DAY,
    };
    const state = resolve(
      JSON.stringify(
        snapshot({
          planKey: "lifetime",
          planName: "Lifetime",
          subscription: lifetime,
          access: deriveAccess("active", lifetime, NOW),
          issuedAt: NOW - OFFLINE_LICENSE_TTL_MS - 365 * DAY,
        }),
      ),
    );
    expect(state.kind).toBe("perpetual");
    expect(state.access.canWrite).toBe(true);
  });

  it("still enforces suspension for perpetual offline modes", () => {
    const state = resolve(
      JSON.stringify(
        snapshot({
          cloudMode: "local_only",
          organizationStatus: "suspended",
          issuedAt: NOW - OFFLINE_LICENSE_TTL_MS - DAY,
        }),
      ),
    );
    expect(state.kind).toBe("perpetual");
    expect(state.access.canWrite).toBe(false);
    expect(state.access.state).toBe("suspended");
  });

  it("preserves subscription grace and expiry transitions while cached", () => {
    const graceExpiry = NOW - DAY;
    const graceState = resolve(
      JSON.stringify(
        snapshot({
          subscription: {
            status: "expired",
            isLifetime: false,
            expiresAt: graceExpiry,
            graceUntil: NOW + DAY,
          },
        }),
      ),
    );
    expect(graceState.access.state).toBe("grace");
    expect(graceState.access.canWrite).toBe(true);

    const expiredState = resolve(
      JSON.stringify(
        snapshot({
          subscription: {
            status: "expired",
            isLifetime: false,
            expiresAt: NOW - 10 * DAY,
            graceUntil: NOW - DAY,
          },
        }),
      ),
    );
    expect(expiredState.access.state).toBe("expired");
    expect(expiredState.access.canWrite).toBe(false);
  });
});
