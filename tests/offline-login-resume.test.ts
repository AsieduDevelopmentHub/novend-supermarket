import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginForm = readFileSync(
  resolve(process.cwd(), "features/auth/components/login-form.tsx"),
  "utf8",
);
const offlineSync = readFileSync(
  resolve(process.cwd(), "docs/architecture/OFFLINE_SYNC.md"),
  "utf8",
);

describe("offline login resume", () => {
  it("restores Continue offline cards only when navigator reports offline", () => {
    expect(loginForm).toContain("Continue offline");
    expect(loginForm).toContain("activateOfflineSession");
    expect(loginForm).toContain("listOfflineSessions");
    expect(loginForm).toContain("showOfflineAccounts");
    expect(loginForm).toContain("!online && cachedAccounts.length > 0");
    // Online shared tills must stay password-only (no passwordless cards).
    expect(loginForm).not.toContain('"Continue on this device"');
  });

  it("falls back to a matching cached shell when password auth cannot reach Convex", () => {
    expect(loginForm).toContain("isConnectivityError(error)");
    expect(loginForm).toContain("matchCachedAccountsByEmail");
    expect(loginForm).toContain("Couldn't reach Novend — opening your cached workspace.");
  });

  it("documents offline picker vs online password-only policy", () => {
    expect(offlineSync).toContain("Online login stays password-only");
    expect(offlineSync).toContain("Continue offline");
    expect(offlineSync).not.toContain("Login never offers a passwordless account picker");
  });
});
