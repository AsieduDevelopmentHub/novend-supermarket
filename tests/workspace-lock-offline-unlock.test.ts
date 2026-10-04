import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const overlay = read("features/auth/components/workspace-lock-overlay.tsx");
const layout = read("app/(app)/app-layout-client.tsx");

describe("workspace lock offline unlock", () => {
  it("uses the device verifier whenever there is no live Convex session", () => {
    expect(overlay).toContain("const liveSession = online && isAuthenticated;");
    expect(overlay).toMatch(/if \(!liveSession\) \{\s*await unlockWithDevicePassword\(\);/);
    expect(overlay).toContain("verifyLocalAuth(email, password)");
  });

  it("only unlocks for the user the till is locked for", () => {
    expect(overlay).toContain("match.userId === identity?.userId");
  });

  it("no longer refuses password unlock just because the till is offline", () => {
    expect(overlay).not.toContain("Password unlock needs a connection");
  });

  it("passes the locked user's id and email from the shell", () => {
    expect(layout).toContain("<AppShellWithIdleLock identity={lockIdentity}>");
    expect(layout).not.toContain("<AppShellWithIdleLock userName=");
  });
});
