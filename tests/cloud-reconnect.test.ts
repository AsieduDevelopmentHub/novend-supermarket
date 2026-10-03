import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const banner = readFileSync(
  resolve(process.cwd(), "features/auth/components/cloud-reconnect-banner.tsx"),
  "utf8",
);
const layout = readFileSync(resolve(process.cwd(), "app/(app)/app-layout-client.tsx"), "utf8");
const offlineSync = readFileSync(
  resolve(process.cwd(), "docs/architecture/OFFLINE_SYNC.md"),
  "utf8",
);

describe("cloud reconnect in place", () => {
  it("auto-opens the password dialog when the radio returns on an offline shell", () => {
    expect(banner).toContain("resolveReconnectEmail");
    expect(banner).toContain("hasOfflineSession");
    expect(banner).toContain("autoOpenedRef");
    expect(banner).toContain("shellEligible");
    expect(banner).toContain("AUTO_OPEN_SETTLE_MS");
    expect(banner).toContain('toast.success("Connected to cloud")');
  });

  it("verifies the reconnected cloud identity before accepting the session", () => {
    expect(banner).toContain("resolvePostLoginSession");
    expect(banner).toContain("expectedUserId: reconnectSession?.userId");
    expect(banner).toContain("expectedOrganizationId: reconnectSession?.organizationId");
  });

  it("keeps reconnect UI across Convex isLoading flicker", () => {
    expect(banner).toContain("shellEligible");
    expect(banner).toContain("canAutoOpen");
    expect(banner).toContain("isOnlineSessionWarm");
    expect(banner).toContain("!onlineLoginWarm");
    expect(banner).not.toMatch(/const eligible = online && !isLoading && !isAuthenticated/);
  });

  it("never kicks an offline shell to /login just because online flipped", () => {
    expect(layout).toContain("awaitingCloudReconnect");
    expect(layout).toContain("isAwaitingCloudReconnect");
    expect(layout).toContain("ensureActiveOfflineSession");
    expect(layout).toContain("CloudReconnectBanner");
    expect(layout).not.toContain("router.refresh()");
  });

  it("error boundaries hard-recover without Next Link or reset-only loops", () => {
    const errorBoundary = readFileSync(resolve(process.cwd(), "app/(app)/error.tsx"), "utf8");
    const globalError = readFileSync(resolve(process.cwd(), "app/global-error.tsx"), "utf8");
    const resume = readFileSync(
      resolve(process.cwd(), "lib/auth/awaiting-cloud-reconnect.ts"),
      "utf8",
    );
    for (const source of [errorBoundary, globalError]) {
      expect(source).toContain("resumeOfflineShellToDashboard");
      expect(source).not.toMatch(/asChild[\s\S]*Link href=["']\/dashboard["']/);
      expect(source).not.toContain("window.location.assign(\"/dashboard\")");
    }
    expect(resume).toContain("hasExplicitLogout()");
    expect(resume).toContain('/login?signedOut=1');
    expect(resume).toContain("readPlatformOfflineSession");
    expect(resume).toContain("/platform?fromBoot=1&recover=1");
    expect(resume).toContain("/dashboard?fromBoot=1&recover=1");
  });

  it("documents in-place reconnect instead of /login", () => {
    expect(offlineSync).toContain("Connect to cloud");
    expect(offlineSync).toContain("without sending the cashier to `/login`");
  });
});
