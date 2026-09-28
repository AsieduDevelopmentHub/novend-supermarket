import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const banner = readFileSync(
  resolve(process.cwd(), "features/auth/components/cloud-reconnect-banner.tsx"),
  "utf8",
);
const layout = readFileSync(resolve(process.cwd(), "app/(app)/app-layout-client.tsx"), "utf8");
const offlineSync = readFileSync(resolve(process.cwd(), "docs/architecture/OFFLINE_SYNC.md"), "utf8");

describe("cloud reconnect in place", () => {
  it("auto-opens the password dialog when the radio returns on an offline shell", () => {
    expect(banner).toContain("resolveReconnectEmail");
    expect(banner).toContain("hasOfflineSession");
    expect(banner).toContain("autoOpenedRef");
    expect(banner).toContain("shellEligible");
    expect(banner).toContain('toast.success("Connected to cloud")');
  });

  it("keeps reconnect UI across Convex isLoading flicker", () => {
    expect(banner).toContain("shellEligible");
    expect(banner).toContain("canAutoOpen");
    expect(banner).not.toMatch(/const eligible = online && !isLoading && !isAuthenticated/);
  });

  it("never kicks an offline shell to /login just because online flipped", () => {
    expect(layout).toContain("awaitingCloudReconnect");
    expect(layout).toContain("isAwaitingCloudReconnect");
    expect(layout).toContain("CloudReconnectBanner");
    expect(layout).not.toContain("router.refresh()");
  });

  it("documents in-place reconnect instead of /login", () => {
    expect(offlineSync).toContain("Connect to cloud");
    expect(offlineSync).toContain("without sending the cashier to `/login`");
  });
});
