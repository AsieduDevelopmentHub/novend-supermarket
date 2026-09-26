import { describe, expect, it } from "vitest";
import { shouldWaitForFirstMirror } from "@/hooks/use-dashboard-data";

describe("shouldWaitForFirstMirror", () => {
  it("is disabled — dashboard uses live Convex while online", async () => {
    await expect(
      shouldWaitForFirstMirror({ online: true, lastSnap: null, empty: true }),
    ).resolves.toBe(false);
  });
});
