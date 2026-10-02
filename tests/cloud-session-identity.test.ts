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
    expect(layout).toContain("localOnlyReady");
    expect(layout).toContain("setLocalOnlyUserId");
    expect(gate).toContain("signOut()");
    expect(gate).toContain("expectedUserId: session.userId");
    expect(gate).toContain("expectedOrganizationId: session.organizationId");
    expect(reconnect).toContain("expectedUserId: reconnectSession?.userId");
  });
});
