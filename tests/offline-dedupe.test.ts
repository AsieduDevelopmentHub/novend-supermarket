import { describe, expect, it } from "vitest";
import {
  dedupeByProductId,
  keepPendingLocalRows,
  mergeServerAndLocalById,
  mergeWholesaleStock,
  pendingLocalIdsFromOutbox,
} from "@/lib/offline/replica-dedupe";

describe("replica dedupe", () => {
  it("collects only pending local ids from open outbox rows", () => {
    const ids = pendingLocalIdsFromOutbox([
      {
        status: "pending",
        payloadJson: JSON.stringify({ localId: "local_purchase_1" }),
      },
      {
        status: "synced",
        payloadJson: JSON.stringify({ localId: "local_purchase_old" }),
      },
      {
        status: "failed",
        payloadJson: JSON.stringify({ localSaleId: "local_sale_1" }),
      },
    ]);
    expect([...ids].sort()).toEqual(["local_purchase_1", "local_sale_1"]);
  });

  it("drops synced local_* rows when merging a snapshot", () => {
    const merged = mergeServerAndLocalById(
      [{ id: "server_po", total: 10 }],
      [
        { id: "local_stale", total: 10 },
        { id: "local_pending", total: 4 },
      ],
      new Set(["local_pending"]),
    );
    expect(merged.map((row) => row.id)).toEqual(["server_po", "local_pending"]);
  });

  it("does not keep local wholesale stock next to the server row for the same product", () => {
    const merged = mergeWholesaleStock(
      [{ id: "ws_server", productId: "prod_1", quantity: 8 }],
      [{ id: "local_ws", productId: "prod_1", quantity: 8 }],
      new Set(["local_ws"]),
    );
    expect(merged).toEqual([{ id: "ws_server", productId: "prod_1", quantity: 8 }]);
  });

  it("prefers the server wholesale stock id when listing", () => {
    const rows = dedupeByProductId([
      { id: "local_ws", productId: "prod_1", quantity: 5 },
      { id: "ws_server", productId: "prod_1", quantity: 8 },
    ]);
    expect(rows).toEqual([{ id: "ws_server", productId: "prod_1", quantity: 8 }]);
  });

  it("keeps a pending local row when it is still in the outbox", () => {
    expect(
      keepPendingLocalRows([{ id: "local_a" }, { id: "local_b" }], new Set(["local_b"])),
    ).toEqual([{ id: "local_b" }]);
  });
});
