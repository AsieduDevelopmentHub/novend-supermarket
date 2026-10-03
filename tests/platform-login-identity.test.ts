import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("platform admin login identity", () => {
  it("claims platform session and clears tenant hint on platform-only me", () => {
    const source = readFileSync(
      resolve(process.cwd(), "lib/auth/redirect-after-login.ts"),
      "utf8",
    );
    expect(source).toContain("me.isPlatformAdmin && !me.organizationId");
    expect(source).toContain("clearOfflineSession()");
    expect(source).toContain("markPlatformOfflineSession(");
    expect(source).toContain("hasTenantRole: false");
    expect(source).toContain("clearPlatformOfflineSession()");
  });

  it("does not revive tenant registry when a platform session is active", () => {
    const session = readFileSync(resolve(process.cwd(), "lib/offline/session.ts"), "utf8");
    expect(session).toContain("readPlatformOfflineSession()");
    expect(session).toContain("if (readPlatformOfflineSession()) return null;");
  });
});
