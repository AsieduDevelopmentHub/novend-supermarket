import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("stale failed outbox clear", () => {
  it("requires explicit Sync Center discard instead of deleting failures during sync", () => {
    const dialog = readFileSync(
      resolve(process.cwd(), "components/offline/sync-center-dialog.tsx"),
      "utf8",
    );
    const engine = readFileSync(resolve(process.cwd(), "lib/offline/sync-engine.ts"), "utf8");
    const actions = readFileSync(
      resolve(process.cwd(), "lib/offline/outbox-actions.ts"),
      "utf8",
    );
    expect(dialog).not.toContain("Clear old problems");
    expect(dialog).not.toContain("Week-old problems can be cleared");
    expect(dialog).not.toContain("discardStaleFailedOutboxEvents");
    expect(engine).not.toContain("discardStaleFailedOutboxEvents");
    expect(actions).not.toContain("discardStaleFailedOutboxEvents");
  });

  it("offers Sign in and discard for auth waits instead of conflict-only Retry", () => {
    const dialog = readFileSync(
      resolve(process.cwd(), "components/offline/sync-center-dialog.tsx"),
      "utf8",
    );
    const engine = readFileSync(resolve(process.cwd(), "lib/offline/sync-engine.ts"), "utf8");
    expect(dialog).toContain("isOutboxAuthWait");
    expect(dialog).toContain("Sign in");
    expect(dialog).toContain("already exists in the cloud");
    expect(dialog).toContain("Sign-in waits need an online email/password session");
    expect(engine).toContain("shouldReopenFailedOutboxWait");
  });
});
