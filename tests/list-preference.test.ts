import { describe, expect, it } from "vitest";
import { pickLiveListWhenOnline, pickReplicaList } from "@/lib/offline/list-preference";

describe("pickReplicaList", () => {
  it("uses Dexie rows while offline", () => {
    const picked = pickReplicaList({ local: [{ id: "1" }], remote: [{ id: "2" }], online: false });
    expect(picked).toEqual({ rows: [{ id: "1" }], source: "local", loading: false });
  });

  it("uses Dexie when it already has catalog rows", () => {
    const picked = pickReplicaList({ local: [{ id: "local_1" }], remote: [{ id: "srv" }], online: true });
    expect(picked.source).toBe("local");
    expect(picked.rows).toEqual([{ id: "local_1" }]);
  });

  it("falls back to live Convex when Dexie is still empty", () => {
    const picked = pickReplicaList({ local: [], remote: [{ id: "srv" }], online: true });
    expect(picked).toEqual({ rows: [{ id: "srv" }], source: "remote", loading: false });
  });
});

describe("pickLiveListWhenOnline", () => {
  it("prefers live Convex when online", () => {
    expect(
      pickLiveListWhenOnline({
        local: [{ id: "local" }],
        remote: [{ id: "live" }],
        online: true,
      }),
    ).toEqual([{ id: "live" }]);
  });

  it("uses Dexie offline", () => {
    expect(
      pickLiveListWhenOnline({
        local: [{ id: "local" }],
        remote: [{ id: "live" }],
        online: false,
      }),
    ).toEqual([{ id: "local" }]);
  });
});
