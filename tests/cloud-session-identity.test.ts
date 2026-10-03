import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getCloudSessionIdentityState } from "@/lib/auth/cloud-session-identity";

describe("cloud session identity guard", () => {
  const minta = { userId: "minta", organizationId: "shop" };

  it("blocks a stale cloud user after an offline account switch", () => {
    expect(
      getCloudSessionIdentityState({
        online: true,
        isAuthenticated: true,
        localIdentity: minta,
        cloudIdentity: { userId: "kwaku", organizationId: "shop" },
      }),
    ).toBe("mismatch");
  });

  it("waits for users.me before mounting the application shell", () => {
    expect(
      getCloudSessionIdentityState({
        online: true,
        isAuthenticated: true,
        localIdentity: minta,
        cloudIdentity: undefined,
      }),
    ).toBe("checking");
  });

  it("accepts only the same cloud user and organization", () => {
    expect(
      getCloudSessionIdentityState({
        online: true,
        isAuthenticated: true,
        localIdentity: minta,
        cloudIdentity: { userId: "minta", organizationId: "shop" },
      }),
    ).toBe("matched");
    expect(
      getCloudSessionIdentityState({
        online: true,
        isAuthenticated: true,
        localIdentity: minta,
        cloudIdentity: { userId: "minta", organizationId: "another-shop" },
      }),
    ).toBe("mismatch");
  });

  it("does not block local work while the device is offline", () => {
    expect(
      getCloudSessionIdentityState({
        online: false,
        isAuthenticated: true,
        localIdentity: minta,
        cloudIdentity: { userId: "kwaku", organizationId: "shop" },
      }),
    ).toBe("not-required");
  });

  it("places the blocking gate before tenant binding and shell providers", () => {
    const layout = readFileSync(
      resolve(process.cwd(), "app/(app)/app-layout-client.tsx"),
      "utf8",
    );
    const gate = readFileSync(
      resolve(process.cwd(), "features/auth/components/cloud-session-mismatch-gate.tsx"),
      "utf8",
    );
    const reconnect = readFileSync(
      resolve(process.cwd(), "features/auth/components/cloud-reconnect-banner.tsx"),
      "utf8",
    );

    expect(layout).toContain("cloudIdentityUnsafe");
    expect(layout).toContain("switchingCloudAccount");
    expect(layout).toContain("<CloudSessionMismatchGate");
    expect(layout.indexOf("if (cloudIdentityBlocked)")).toBeLessThan(
      layout.indexOf("if (cloudIdentityChecking)"),
    );
    expect(layout.indexOf("if (cloudIdentityBlocked)")).toBeLessThan(
      layout.indexOf("// Keep Dexie bound"),
    );
    expect(layout).toContain("Do not clear the latch on a connectivity flap");
    expect(gate).toContain("await withTimeout(");
    expect(gate).toContain("verifyLocalAuth");
    expect(gate.indexOf("verifyLocalAuth(email, rawPassword)")).toBeLessThan(
      gate.indexOf("signOut()"),
    );
    expect(gate).toContain("Incorrect password. Try again.");
    expect(gate).toContain("Continue locally");
    expect(gate).toContain("onContinueLocally");
    expect(gate).toContain("onCloudConnected");
    expect(layout).toContain("localOnlyReady");
    expect(layout).toContain("suppressCloudIdentityQuery");
    expect(layout).toContain("rememberLocalOnlyCloudUser");
    expect(layout).toContain("setLocalOnlyUserId");
    expect(gate).toContain("signOut()");
    expect(gate).toContain("const signOutAttempt = signOut()");
    expect(gate).toContain("void signOutAttempt.catch(() => undefined)");
    expect(gate.indexOf("onContinueLocally()")).toBeLessThan(
      gate.indexOf("const signOutAttempt = signOut()"),
    );
    expect(gate).toContain('setPendingAction("local")');
    expect(gate).toContain("Could not close the previous cloud session in time.");
    expect(layout).toContain("ONLINE_AUTH_BUDGET_MS");
    expect(layout).toContain("cloudIdentityChecking && onlineAuthBudgetElapsed && expectedCloudSession");
    expect(gate).toContain("expectedUserId: session.userId");
    expect(gate).toContain("expectedOrganizationId: session.organizationId");
    expect(reconnect).toContain("expectedUserId: reconnectSession?.userId");
    expect(reconnect).toContain("clearLocalOnlyCloudUser()");
    expect(layout).toContain("LOCAL_ONLY_CLOUD_USER_EVENT");
    expect(layout).toContain("localOnlyReady");
    expect(layout).toContain("loginRedirectStarted.current = false");
    expect(layout).toContain("localOnlyUserId || readLocalOnlyCloudUserId()");
    expect(layout).toContain("localOnlyUserId && !isAuthenticated");
    expect(layout).toContain("setCloudSwitchUserId(activeLocalUserId)");
    expect(reconnect).toContain("void pullSnapshot().then");
    expect(reconnect).not.toContain("pullSnapshot({ force: true })");
  });

  it("Continue locally sets a middleware-readable cookie before JWT clear", () => {
    const reconnectLib = readFileSync(
      resolve(process.cwd(), "lib/auth/awaiting-cloud-reconnect.ts"),
      "utf8",
    );
    const proxy = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");
    expect(reconnectLib).toContain('LOCAL_ONLY_CLOUD_COOKIE = "novend_local_only"');
    expect(reconnectLib).toContain("writeLocalOnlyCookie(userId)");
    expect(reconnectLib).toContain("clearLocalOnlyCookie()");
    expect(proxy).toContain('LOCAL_ONLY_CLOUD_COOKIE = "novend_local_only"');
    expect(proxy).toContain("hasLocalOnlyShellCookie");
    expect(proxy).toContain("hasLocalOnlyShellCookie(request) && !isPlatformRoute(request)");
  });
});
