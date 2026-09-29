/**
 * Pure hotel reservation conflict helpers (unit-tested).
 * Half-open date ranges: [arrival, departure) — departure day is free for the next guest.
 */

export const RESERVATION_STATUSES_BLOCKING_ROOM = [
  "booked",
  "confirmed",
  "checked_in",
] as const;

export type BlockingReservationStatus = (typeof RESERVATION_STATUSES_BLOCKING_ROOM)[number];

export type ReservationDateRange = {
  arrivalDate: string;
  departureDate: string;
};

export type ReservationConflictCandidate = ReservationDateRange & {
  id: string;
  roomId: string | null | undefined;
  status: string;
};

export type RoomAvailabilityCandidate = {
  id: string;
  name: string;
  status: string;
  branchId?: string;
};

export type OpenStayCandidate = {
  roomId: string;
  status: string;
  /** YYYY-MM-DD derived from check-in; open stays block from this day forward. */
  checkInDate: string;
};

/** True when [aArrival, aDeparture) overlaps [bArrival, bDeparture). */
export function reservationDatesOverlap(
  a: ReservationDateRange,
  b: ReservationDateRange,
): boolean {
  return a.arrivalDate < b.departureDate && a.departureDate > b.arrivalDate;
}

export function isBlockingReservationStatus(status: string): status is BlockingReservationStatus {
  return (RESERVATION_STATUSES_BLOCKING_ROOM as readonly string[]).includes(status);
}

/**
 * Other reservations on the same room that block the proposed stay.
 * Excludes cancelled, no-show, and the reservation being updated (`excludeReservationId`).
 * Checked-out stays are not reservations — open stays are handled separately.
 */
export function findOverlappingReservations(input: {
  roomId: string;
  arrivalDate: string;
  departureDate: string;
  existing: readonly ReservationConflictCandidate[];
  excludeReservationId?: string | null;
}): ReservationConflictCandidate[] {
  const proposed: ReservationDateRange = {
    arrivalDate: input.arrivalDate,
    departureDate: input.departureDate,
  };
  return input.existing.filter((row) => {
    if (input.excludeReservationId && row.id === input.excludeReservationId) return false;
    if (!row.roomId || row.roomId !== input.roomId) return false;
    if (!isBlockingReservationStatus(row.status)) return false;
    return reservationDatesOverlap(proposed, row);
  });
}

/** Open stay on a room blocks any overlapping proposed dates (open = through far future). */
export function openStayOverlapsDates(input: {
  roomId: string;
  arrivalDate: string;
  departureDate: string;
  openStays: readonly OpenStayCandidate[];
}): boolean {
  const FAR_FUTURE = "9999-12-31";
  for (const stay of input.openStays) {
    if (stay.status !== "open" || stay.roomId !== input.roomId) continue;
    if (
      reservationDatesOverlap(
        { arrivalDate: input.arrivalDate, departureDate: input.departureDate },
        { arrivalDate: stay.checkInDate, departureDate: FAR_FUTURE },
      )
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Point-in-time room.status === occupied blocks assignment for overlapping dates
 * that include "today" or any future stay while the room is marked occupied.
 * Conservative rule: while status is occupied, reject any reservation for that room.
 */
export function roomStatusBlocksAssignment(roomStatus: string): boolean {
  return roomStatus === "occupied";
}

export function listAvailableRoomsForDates(input: {
  rooms: readonly RoomAvailabilityCandidate[];
  arrivalDate: string;
  departureDate: string;
  reservations: readonly ReservationConflictCandidate[];
  openStays: readonly OpenStayCandidate[];
  branchId?: string | null;
  excludeReservationId?: string | null;
}): RoomAvailabilityCandidate[] {
  return input.rooms.filter((room) => {
    if (input.branchId && room.branchId && room.branchId !== input.branchId) return false;
    if (room.status === "inactive" || room.status === "maintenance") return false;
    if (roomStatusBlocksAssignment(room.status)) return false;
    if (
      openStayOverlapsDates({
        roomId: room.id,
        arrivalDate: input.arrivalDate,
        departureDate: input.departureDate,
        openStays: input.openStays,
      })
    ) {
      return false;
    }
    const conflicts = findOverlappingReservations({
      roomId: room.id,
      arrivalDate: input.arrivalDate,
      departureDate: input.departureDate,
      existing: input.reservations,
      excludeReservationId: input.excludeReservationId,
    });
    return conflicts.length === 0;
  });
}

export type RoomAssignmentConflict =
  | { kind: "reservation"; message: string }
  | { kind: "open_stay"; message: string }
  | { kind: "occupied"; message: string };

export function evaluateRoomAssignmentConflict(input: {
  roomId: string;
  roomName?: string | null;
  roomStatus: string;
  arrivalDate: string;
  departureDate: string;
  reservations: readonly ReservationConflictCandidate[];
  openStays: readonly OpenStayCandidate[];
  excludeReservationId?: string | null;
  availableRoomNames?: readonly string[];
}): RoomAssignmentConflict | null {
  const roomLabel = input.roomName?.trim() || "This room";

  if (roomStatusBlocksAssignment(input.roomStatus)) {
    return {
      kind: "occupied",
      message: formatConflictMessage(
        `${roomLabel} is currently occupied and cannot be reserved for overlapping dates.`,
        input.availableRoomNames,
      ),
    };
  }

  if (
    openStayOverlapsDates({
      roomId: input.roomId,
      arrivalDate: input.arrivalDate,
      departureDate: input.departureDate,
      openStays: input.openStays,
    })
  ) {
    return {
      kind: "open_stay",
      message: formatConflictMessage(
        `${roomLabel} already has an open stay overlapping these dates.`,
        input.availableRoomNames,
      ),
    };
  }

  const overlaps = findOverlappingReservations({
    roomId: input.roomId,
    arrivalDate: input.arrivalDate,
    departureDate: input.departureDate,
    existing: input.reservations,
    excludeReservationId: input.excludeReservationId,
  });
  if (overlaps.length > 0) {
    return {
      kind: "reservation",
      message: formatConflictMessage(
        `${roomLabel} already has a booked, confirmed, or checked-in reservation overlapping these dates.`,
        input.availableRoomNames,
      ),
    };
  }

  return null;
}

export function formatConflictMessage(
  base: string,
  availableRoomNames?: readonly string[],
): string {
  if (!availableRoomNames?.length) return base;
  const sample = availableRoomNames.slice(0, 5).join(", ");
  const more =
    availableRoomNames.length > 5 ? ` (+${availableRoomNames.length - 5} more)` : "";
  return `${base} Available: ${sample}${more}.`;
}

export function millisToIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
