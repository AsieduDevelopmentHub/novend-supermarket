import { describe, expect, it } from "vitest";
import {
  COMPACT_SNAPSHOT_HISTORY_MS,
  exportCompactSnapshot,
} from "@/lib/offline/compact-snapshot";

describe("compact snapshot constants", () => {
  it("keeps a 90-day history window", () => {
    expect(COMPACT_SNAPSHOT_HISTORY_MS).toBe(90 * 24 * 60 * 60 * 1000);
  });
});

describe("exportCompactSnapshot", () => {
  it("fails clearly when Dexie is unavailable in this environment", async () => {
    await expect(exportCompactSnapshot()).rejects.toThrow(/Local database is not available/);
  });
});
