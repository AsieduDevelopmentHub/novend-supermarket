import { describe, expect, it } from "vitest";
import {
  bumpReplicaWriteEpoch,
  replicaWriteEpoch,
  shouldApplyFetchedSnapshot,
} from "@/lib/offline/replica-events";

describe("replica write epoch", () => {
  it("rejects a snapshot fetched before a later local write", () => {
    const start = replicaWriteEpoch();
    expect(shouldApplyFetchedSnapshot(start)).toBe(true);
    bumpReplicaWriteEpoch();
    expect(shouldApplyFetchedSnapshot(start)).toBe(false);
    expect(shouldApplyFetchedSnapshot(replicaWriteEpoch())).toBe(true);
  });
});
