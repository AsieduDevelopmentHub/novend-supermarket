/**
 * Unified open-operations model for Orders (Phase D).
 * Open checks / folios / reservations are not completed sales.
 */

export const OPEN_OPERATION_SOURCES = [
  "restaurant_table",
  "bar_tab",
  "room_folio",
  "reservation",
] as const;

export type OpenOperationSource = (typeof OPEN_OPERATION_SOURCES)[number];

export const OPEN_OPERATION_KINDS = [
  "dining_session",
  "hotel_stay",
  "hotel_reservation",
] as const;

export type OpenOperationKind = (typeof OPEN_OPERATION_KINDS)[number];

export type OpenOperationRow = {
  id: string;
  kind: OpenOperationKind;
  source: OpenOperationSource;
  originLabel: string;
  status: string;
  paymentStatus: "unpaid";
  fulfilmentStatus: string | null;
  branchId: string;
  branchName: string | null;
  openedAt: number;
  total: number;
  itemCount: number;
  guestLabel: string | null;
  serverName: string | null;
  kitchenOpenCount: number;
  kitchenReadyCount: number;
  href: string;
};

export function diningSourceForIndustry(
  industryProfile: string | null | undefined,
): Extract<OpenOperationSource, "restaurant_table" | "bar_tab"> {
  return industryProfile === "bar" ? "bar_tab" : "restaurant_table";
}

export function originLabelForOperation(row: {
  kind: OpenOperationKind;
  tableName?: string | null;
  roomName?: string | null;
  reservationRef?: string | null;
}): string {
  if (row.kind === "dining_session") {
    return row.tableName?.trim() ? `Table ${row.tableName.trim()}` : "Table check";
  }
  if (row.kind === "hotel_stay") {
    return row.roomName?.trim() ? `Room ${row.roomName.trim()}` : "Room folio";
  }
  const ref = row.reservationRef?.trim();
  return ref ? `Reservation ${ref}` : "Reservation";
}

export function fulfilmentLabel(input: {
  kitchenOpenCount: number;
  kitchenReadyCount: number;
  kind: OpenOperationKind;
}): string | null {
  if (input.kind !== "dining_session") return null;
  if (input.kitchenReadyCount > 0) return "Ready";
  if (input.kitchenOpenCount > 0) return "Preparing";
  return "Open";
}

export function filterOpenOperations(
  rows: OpenOperationRow[],
  filters: {
    branchId?: string | null;
    source?: OpenOperationSource | "all";
    status?: string | "all";
    search?: string;
  },
): OpenOperationRow[] {
  const search = filters.search?.trim().toLowerCase() ?? "";
  return rows.filter((row) => {
    if (filters.branchId && filters.branchId !== "all" && row.branchId !== filters.branchId) {
      return false;
    }
    if (filters.source && filters.source !== "all" && row.source !== filters.source) {
      return false;
    }
    if (filters.status && filters.status !== "all" && row.status !== filters.status) {
      return false;
    }
    if (!search) return true;
    const hay = [
      row.originLabel,
      row.guestLabel,
      row.serverName,
      row.branchName,
      row.status,
      row.source,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(search);
  });
}

export function sortOpenOperationsNewestFirst(rows: OpenOperationRow[]): OpenOperationRow[] {
  return [...rows].sort((a, b) => b.openedAt - a.openedAt);
}
