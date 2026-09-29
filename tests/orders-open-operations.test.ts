import { describe, expect, it } from "vitest";
import {
  OPEN_OPERATION_KINDS,
  OPEN_OPERATION_SOURCES,
  diningSourceForIndustry,
  filterOpenOperations,
  fulfilmentLabel,
  originLabelForOperation,
  sortOpenOperationsNewestFirst,
  type OpenOperationRow,
} from "@/features/orders/open-operations";
import { ORDERS_ACTIVITY_TABS, OPEN_OPERATION_SOURCE_FILTERS } from "@/features/orders/constants";

function sampleRow(partial: Partial<OpenOperationRow> = {}): OpenOperationRow {
  return {
    id: "op1",
    kind: "dining_session",
    source: "restaurant_table",
    originLabel: "Table 4",
    status: "open",
    paymentStatus: "unpaid",
    fulfilmentStatus: "Open",
    branchId: "b1",
    branchName: "Main",
    openedAt: 100,
    total: 50,
    itemCount: 2,
    guestLabel: null,
    serverName: null,
    kitchenOpenCount: 0,
    kitchenReadyCount: 0,
    href: "/floor",
    ...partial,
  };
}

describe("orders open operations contract", () => {
  it("exposes activity tabs All | Open | Completed", () => {
    expect(ORDERS_ACTIVITY_TABS.map((t) => t.value)).toEqual(["all", "open", "completed"]);
  });

  it("defines operational sources without treating them as completed POS sales", () => {
    expect(OPEN_OPERATION_SOURCES).toContain("restaurant_table");
    expect(OPEN_OPERATION_SOURCES).toContain("bar_tab");
    expect(OPEN_OPERATION_SOURCES).toContain("room_folio");
    expect(OPEN_OPERATION_SOURCES).toContain("reservation");
    expect(OPEN_OPERATION_SOURCES).not.toContain("pos");
    expect(OPEN_OPERATION_SOURCE_FILTERS.some((f) => f.value === "all")).toBe(true);
  });

  it("maps industry profile to dining source", () => {
    expect(diningSourceForIndustry("bar")).toBe("bar_tab");
    expect(diningSourceForIndustry("restaurant")).toBe("restaurant_table");
    expect(diningSourceForIndustry(undefined)).toBe("restaurant_table");
  });

  it("builds origin labels for table, room, and reservation", () => {
    expect(
      originLabelForOperation({ kind: "dining_session", tableName: "4" }),
    ).toBe("Table 4");
    expect(originLabelForOperation({ kind: "hotel_stay", roomName: "101" })).toBe("Room 101");
    expect(
      originLabelForOperation({ kind: "hotel_reservation", reservationRef: "#ABCDEF" }),
    ).toBe("Reservation #ABCDEF");
  });

  it("derives kitchen fulfilment labels", () => {
    expect(
      fulfilmentLabel({ kind: "dining_session", kitchenOpenCount: 0, kitchenReadyCount: 0 }),
    ).toBe("Open");
    expect(
      fulfilmentLabel({ kind: "dining_session", kitchenOpenCount: 1, kitchenReadyCount: 0 }),
    ).toBe("Preparing");
    expect(
      fulfilmentLabel({ kind: "dining_session", kitchenOpenCount: 0, kitchenReadyCount: 1 }),
    ).toBe("Ready");
    expect(
      fulfilmentLabel({ kind: "hotel_stay", kitchenOpenCount: 0, kitchenReadyCount: 0 }),
    ).toBeNull();
  });

  it("filters by source, status, branch, and search", () => {
    const rows = [
      sampleRow({ id: "1", source: "room_folio", kind: "hotel_stay", originLabel: "Room 101" }),
      sampleRow({
        id: "2",
        source: "reservation",
        kind: "hotel_reservation",
        status: "confirmed",
        originLabel: "Reservation #1",
        guestLabel: "Ada",
      }),
      sampleRow({ id: "3", branchId: "b2", originLabel: "Table 9" }),
    ];
    expect(filterOpenOperations(rows, { source: "room_folio" })).toHaveLength(1);
    expect(filterOpenOperations(rows, { status: "confirmed" })).toHaveLength(1);
    expect(filterOpenOperations(rows, { branchId: "b2" })).toHaveLength(1);
    expect(filterOpenOperations(rows, { search: "ada" })).toHaveLength(1);
  });

  it("sorts newest first", () => {
    const sorted = sortOpenOperationsNewestFirst([
      sampleRow({ id: "old", openedAt: 10 }),
      sampleRow({ id: "new", openedAt: 99 }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("keeps open-operation kinds distinct from completed sales", () => {
    expect(OPEN_OPERATION_KINDS).toEqual([
      "dining_session",
      "hotel_stay",
      "hotel_reservation",
    ]);
  });
});
