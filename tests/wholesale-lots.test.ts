import { describe, expect, it } from "vitest";
import {
  addBranchLot,
  addWholesaleLot,
  replayPendingWarehouseLots,
  takeWholesaleLotsFefo,
} from "@/lib/offline/wholesale-lots";
import type {
  MirroredLot,
  MirroredWholesaleLot,
  OutboxRow,
  RecordWholesalePurchasePayload,
  WholesaleTransferPayload,
} from "@/lib/offline/types";

const lot = (
  id: string,
  quantity: number,
  expiryDate: string,
  receivedAt = 1,
  productId = "p1",
): MirroredWholesaleLot => ({
  id,
  productId,
  quantity,
  expiryDate,
  receivedAt,
  lotCode: expiryDate,
});

describe("takeWholesaleLotsFefo", () => {
  it("issues the earliest expiry first across lots", () => {
    const lots = [lot("late", 10, "2027-06-01"), lot("soon", 4, "2027-01-01")];
    const { lots: remaining, taken } = takeWholesaleLotsFefo(lots, "p1", 6);
    expect(taken).toEqual([
      { lotId: "soon", quantity: 4, expiryDate: "2027-01-01" },
      { lotId: "late", quantity: 2, expiryDate: "2027-06-01" },
    ]);
    expect(remaining).toEqual([lot("late", 8, "2027-06-01")]);
  });

  it("breaks an expiry tie by earliest receipt", () => {
    const lots = [lot("b", 5, "2027-01-01", 20), lot("a", 5, "2027-01-01", 10)];
    expect(takeWholesaleLotsFefo(lots, "p1", 3).taken[0]?.lotId).toBe("a");
  });

  it("refuses to oversell and never mutates its input", () => {
    const lots = [lot("a", 5, "2027-01-01")];
    expect(() => takeWholesaleLotsFefo(lots, "p1", 6)).toThrow(
      /insufficient dated wholesale stock/i,
    );
    takeWholesaleLotsFefo(lots, "p1", 2);
    expect(lots[0]?.quantity).toBe(5);
  });

  it("ignores other products", () => {
    const lots = [lot("other", 99, "2027-01-01", 1, "p2")];
    expect(() => takeWholesaleLotsFefo(lots, "p1", 1)).toThrow();
  });
});

describe("addWholesaleLot", () => {
  it("merges a receipt into the lot with the same expiry", () => {
    const merged = addWholesaleLot([lot("a", 5, "2027-01-01")], {
      id: "new",
      productId: "p1",
      quantity: 7,
      expiryDate: "2027-01-01",
      receivedAt: 5,
    });
    expect(merged).toHaveLength(1);
    expect(merged[0]?.quantity).toBe(12);
  });

  it("creates a new lot for a new expiry date", () => {
    const next = addWholesaleLot([lot("a", 5, "2027-01-01")], {
      id: "new",
      productId: "p1",
      quantity: 7,
      expiryDate: "2027-09-01",
      receivedAt: 5,
    });
    expect(next.map((row) => row.expiryDate)).toEqual(["2027-01-01", "2027-09-01"]);
  });
});

function row(
  type: OutboxRow["type"],
  payload: RecordWholesalePurchasePayload | WholesaleTransferPayload,
  createdAt: number,
  status: OutboxRow["status"] = "pending",
): OutboxRow {
  return {
    id: `row_${createdAt}`,
    type,
    clientOperationId: `op_${createdAt}`,
    payloadJson: JSON.stringify(payload),
    status,
    attempts: 0,
    createdAt,
    updatedAt: createdAt,
  };
}

describe("replayPendingWarehouseLots", () => {
  const dated = new Set(["p1"]);
  const branchName = (id: string) => (id === "b1" ? "Main" : null);

  it("re-applies an unsynced transfer so a snapshot cannot resurrect issued stock", () => {
    const transfer: WholesaleTransferPayload = {
      localId: "local_t1",
      productId: "p1",
      branchId: "b1",
      quantity: 6,
    } as WholesaleTransferPayload;
    const result = replayPendingWarehouseLots({
      warehouseLots: [lot("soon", 4, "2027-01-01"), lot("late", 10, "2027-06-01")],
      branchLots: [],
      outbox: [row("wholesale_transfer", transfer, 10)],
      datedProductIds: dated,
      branchName,
    });
    expect(result.warehouseLots.map((l) => [l.expiryDate, l.quantity])).toEqual([
      ["2027-06-01", 8],
    ]);
    const branchTotals = result.branchLots.map((l: MirroredLot) => [l.expiryDate, l.quantity]);
    expect(branchTotals).toEqual([
      ["2027-01-01", 4],
      ["2027-06-01", 2],
    ]);
    expect(result.branchLots.every((l) => l.branchName === "Main")).toBe(true);
  });

  it("adds a pending dated purchase and skips synced rows and undated products", () => {
    const purchase = (productId: string, localId: string): RecordWholesalePurchasePayload =>
      ({
        localId,
        supplierId: "s1",
        purchasedAt: 5,
        items: [{ productId, quantity: 20, unitCost: 1, expiryDate: "2027-03-01" }],
      }) as RecordWholesalePurchasePayload;
    const result = replayPendingWarehouseLots({
      warehouseLots: [],
      branchLots: [],
      outbox: [
        row("record_wholesale_purchase", purchase("p1", "local_a"), 1),
        row("record_wholesale_purchase", purchase("p2", "local_b"), 2),
        row("record_wholesale_purchase", purchase("p1", "local_c"), 3, "synced"),
      ],
      datedProductIds: dated,
      branchName,
    });
    expect(result.warehouseLots).toHaveLength(1);
    expect(result.warehouseLots[0]).toMatchObject({ productId: "p1", quantity: 20 });
  });

  it("does not throw when a stale transfer can no longer be satisfied", () => {
    const transfer = {
      localId: "local_t2",
      productId: "p1",
      branchId: "b1",
      quantity: 50,
    } as WholesaleTransferPayload;
    const result = replayPendingWarehouseLots({
      warehouseLots: [lot("a", 5, "2027-01-01")],
      branchLots: [],
      outbox: [row("wholesale_transfer", transfer, 1)],
      datedProductIds: dated,
      branchName,
    });
    expect(result.warehouseLots[0]?.quantity).toBe(5);
  });
});

describe("addBranchLot", () => {
  it("merges by product, branch and expiry", () => {
    const base: MirroredLot = {
      id: "l1",
      productId: "p1",
      branchId: "b1",
      branchName: "Main",
      quantity: 3,
      expiryDate: "2027-01-01",
      lotCode: "2027-01-01",
      receivedAt: 1,
    };
    const merged = addBranchLot([base], {
      id: "l2",
      productId: "p1",
      branchId: "b1",
      branchName: "Main",
      quantity: 2,
      expiryDate: "2027-01-01",
      receivedAt: 2,
    });
    expect(merged).toHaveLength(1);
    expect(merged[0]?.quantity).toBe(5);
    expect(
      addBranchLot([base], {
        id: "l3",
        productId: "p1",
        branchId: "b2",
        branchName: null,
        quantity: 2,
        expiryDate: "2027-01-01",
        receivedAt: 2,
      }),
    ).toHaveLength(2);
  });
});
