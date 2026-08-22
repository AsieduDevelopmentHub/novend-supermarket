import { describe, expect, it } from "vitest";
import {
  deriveAccess,
  evaluateCachedLicense,
  buildUsageMetric,
  hasCapacity,
  GRACE_PERIOD_MS,
  OFFLINE_LICENSE_TTL_MS,
  type LicenseSnapshot,
  type SubscriptionSnapshot,
} from "@/convex/shared/licensing";

const NOW = Date.UTC(2026, 0, 15);
const DAY = 24 * 60 * 60 * 1000;

function subscription(overrides: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot {
  return { status: "active", isLifetime: false, expiresAt: NOW + 10 * DAY, ...overrides };
}

describe("deriveAccess — organization status wins", () => {
  it("blocks a disabled business completely", () => {
    const access = deriveAccess("disabled", subscription(), NOW);
    expect(access.state).toBe("disabled");
    expect(access.canRead).toBe(false);
    expect(access.canWrite).toBe(false);
  });

  it("treats the legacy 'inactive' status as disabled", () => {
    expect(deriveAccess("inactive", subscription(), NOW).state).toBe("disabled");
  });

  it("leaves a suspended business read-only even with a paid subscription", () => {
    const access = deriveAccess("suspended", subscription(), NOW);
    expect(access.canRead).toBe(true);
    expect(access.canWrite).toBe(false);
  });
});

describe("deriveAccess — subscription lifecycle", () => {
  it("allows everything on an active subscription", () => {
    const access = deriveAccess("active", subscription(), NOW);
    expect(access.state).toBe("active");
    expect(access.canWrite).toBe(true);
    expect(access.reason).toBeNull();
  });

  it("never expires a lifetime licence", () => {
    const access = deriveAccess(
      "active",
      subscription({ isLifetime: true, expiresAt: NOW - 5000 * DAY }),
      NOW,
    );
    expect(access.state).toBe("active");
    expect(access.canWrite).toBe(true);
  });

  it("keeps selling during the grace window after expiry", () => {
    const expiresAt = NOW - DAY;
    const access = deriveAccess("active", subscription({ expiresAt }), NOW);
    expect(access.state).toBe("grace");
    expect(access.canWrite).toBe(true);
    expect(access.expiresAt).toBe(expiresAt + GRACE_PERIOD_MS);
  });

  it("drops to read-only once the grace window closes", () => {
    const expiresAt = NOW - GRACE_PERIOD_MS - DAY;
    const access = deriveAccess("active", subscription({ expiresAt }), NOW);
    expect(access.state).toBe("expired");
    expect(access.canRead).toBe(true);
    expect(access.canWrite).toBe(false);
  });

  it("keeps a past_due subscription writable so payment can be fixed", () => {
    const access = deriveAccess("active", subscription({ status: "past_due" }), NOW);
    expect(access.state).toBe("grace");
    expect(access.canWrite).toBe(true);
  });

  it("reports a trial and its end date", () => {
    const expiresAt = NOW + 5 * DAY;
    const access = deriveAccess("trial", subscription({ status: "trialing", expiresAt }), NOW);
    expect(access.state).toBe("trial");
    expect(access.canWrite).toBe(true);
    expect(access.expiresAt).toBe(expiresAt);
    expect(access.reason).toMatch(/trial/i);
  });

  it("does not lock out a business that has no subscription record yet", () => {
    const access = deriveAccess("active", null, NOW);
    expect(access.canWrite).toBe(true);
  });

  it("keeps an expired organization read-only when there is no subscription", () => {
    const access = deriveAccess("expired", null, NOW);
    expect(access.state).toBe("expired");
    expect(access.canRead).toBe(true);
    expect(access.canWrite).toBe(false);
  });
});

describe("evaluateCachedLicense", () => {
  function snapshot(issuedAt: number): LicenseSnapshot {
    return {
      organizationId: "org1",
      organizationName: "Test Shop",
      planKey: "pro",
      planName: "Pro",
      organizationStatus: "active",
      subscription: subscription(),
      access: deriveAccess("active", subscription(), issuedAt),
      limits: { products: 5000, users: 15, branches: 5, devices: 15, backupBytes: null },
      features: [],
      issuedAt,
    };
  }

  it("trusts a recent cache while offline", () => {
    const access = evaluateCachedLicense(snapshot(NOW - DAY), NOW);
    expect(access.stale).toBe(false);
    expect(access.canWrite).toBe(true);
  });

  it("falls back to read-only when the cache outlives its TTL", () => {
    const access = evaluateCachedLicense(snapshot(NOW - OFFLINE_LICENSE_TTL_MS - DAY), NOW);
    expect(access.stale).toBe(true);
    expect(access.canRead).toBe(true);
    expect(access.canWrite).toBe(false);
  });
});

describe("usage metrics", () => {
  it("treats a null limit as unlimited", () => {
    const metric = buildUsageMetric("products", 12_000, null);
    expect(metric.unlimited).toBe(true);
    expect(metric.level).toBe("ok");
    expect(hasCapacity(metric, 1_000_000)).toBe(true);
  });

  it("informs from 80 percent and warns from 95 percent", () => {
    expect(buildUsageMetric("users", 11, 15).level).toBe("ok");
    expect(buildUsageMetric("users", 12, 15).level).toBe("info");
    expect(buildUsageMetric("products", 400, 500).level).toBe("info");
    expect(buildUsageMetric("products", 475, 500).level).toBe("warning");
    expect(buildUsageMetric("products", 500, 500).level).toBe("full");
  });

  it("reports full at the limit and refuses more capacity", () => {
    const metric = buildUsageMetric("branches", 5, 5);
    expect(metric.level).toBe("full");
    expect(metric.remaining).toBe(0);
    expect(hasCapacity(metric)).toBe(false);
  });

  it("caps the percentage when usage exceeds a lowered limit", () => {
    const metric = buildUsageMetric("products", 900, 500);
    expect(metric.percent).toBe(100);
    expect(metric.remaining).toBe(0);
  });
});
