import { describe, expect, it } from "vitest";
import {
  evaluateRoomAssignmentConflict,
  findOverlappingReservations,
  formatConflictMessage,
  listAvailableRoomsForDates,
  openStayOverlapsDates,
  reservationDatesOverlap,
  roomStatusBlocksAssignment,
} from "@/convex/shared/hotelReservations";

describe("reservationDatesOverlap", () => {
  it("detects overlapping mid-stays", () => {
    expect(
      reservationDatesOverlap(
        { arrivalDate: "2026-09-01", departureDate: "2026-09-05" },
        { arrivalDate: "2026-09-03", departureDate: "2026-09-07" },
      ),
    ).toBe(true);
  });

  it("allows back-to-back stays (departure === next arrival)", () => {
    expect(
      reservationDatesOverlap(
        { arrivalDate: "2026-09-01", departureDate: "2026-09-05" },
        { arrivalDate: "2026-09-05", departureDate: "2026-09-08" },
      ),
    ).toBe(false);
  });

  it("rejects identical ranges", () => {
    expect(
      reservationDatesOverlap(
        { arrivalDate: "2026-09-01", departureDate: "2026-09-03" },
        { arrivalDate: "2026-09-01", departureDate: "2026-09-03" },
      ),
    ).toBe(true);
  });
});

describe("findOverlappingReservations", () => {
  const existing = [
    {
      id: "r1",
      roomId: "room-a",
      status: "confirmed",
      arrivalDate: "2026-09-10",
      departureDate: "2026-09-12",
    },
    {
      id: "r2",
      roomId: "room-a",
      status: "cancelled",
      arrivalDate: "2026-09-10",
      departureDate: "2026-09-12",
    },
    {
      id: "r3",
      roomId: "room-a",
      status: "no_show",
      arrivalDate: "2026-09-10",
      departureDate: "2026-09-12",
    },
    {
      id: "r4",
      roomId: "room-b",
      status: "booked",
      arrivalDate: "2026-09-10",
      departureDate: "2026-09-12",
    },
    {
      id: "r5",
      roomId: "room-a",
      status: "checked_in",
      arrivalDate: "2026-09-01",
      departureDate: "2026-09-20",
    },
  ];

  it("rejects overlapping booked/confirmed/checked_in on the same room", () => {
    const hits = findOverlappingReservations({
      roomId: "room-a",
      arrivalDate: "2026-09-11",
      departureDate: "2026-09-13",
      existing,
    });
    expect(hits.map((h) => h.id).sort()).toEqual(["r1", "r5"]);
  });

  it("ignores cancelled and no-show", () => {
    const hits = findOverlappingReservations({
      roomId: "room-a",
      arrivalDate: "2026-09-10",
      departureDate: "2026-09-12",
      existing: existing.filter((r) => r.id === "r2" || r.id === "r3"),
    });
    expect(hits).toHaveLength(0);
  });

  it("excludes the reservation being updated", () => {
    const hits = findOverlappingReservations({
      roomId: "room-a",
      arrivalDate: "2026-09-10",
      departureDate: "2026-09-12",
      existing,
      excludeReservationId: "r1",
    });
    expect(hits.map((h) => h.id)).toEqual(["r5"]);
  });
});

describe("open stay and occupied room", () => {
  it("blocks when an open stay overlaps proposed dates", () => {
    expect(
      openStayOverlapsDates({
        roomId: "room-a",
        arrivalDate: "2026-09-28",
        departureDate: "2026-09-30",
        openStays: [{ roomId: "room-a", status: "open", checkInDate: "2026-09-20" }],
      }),
    ).toBe(true);
  });

  it("does not block closed stays", () => {
    expect(
      openStayOverlapsDates({
        roomId: "room-a",
        arrivalDate: "2026-09-28",
        departureDate: "2026-09-30",
        openStays: [{ roomId: "room-a", status: "closed", checkInDate: "2026-09-20" }],
      }),
    ).toBe(false);
  });

  it("treats occupied status as blocking", () => {
    expect(roomStatusBlocksAssignment("occupied")).toBe(true);
    expect(roomStatusBlocksAssignment("available")).toBe(false);
    expect(roomStatusBlocksAssignment("dirty")).toBe(false);
  });
});

describe("listAvailableRoomsForDates + conflict message", () => {
  const rooms = [
    { id: "a", name: "101", status: "available", branchId: "b1" },
    { id: "b", name: "102", status: "occupied", branchId: "b1" },
    { id: "c", name: "103", status: "available", branchId: "b1" },
    { id: "d", name: "201", status: "maintenance", branchId: "b1" },
  ];

  it("suggests only free rooms", () => {
    const available = listAvailableRoomsForDates({
      rooms,
      arrivalDate: "2026-10-01",
      departureDate: "2026-10-03",
      reservations: [
        {
          id: "r1",
          roomId: "c",
          status: "confirmed",
          arrivalDate: "2026-10-01",
          departureDate: "2026-10-04",
        },
      ],
      openStays: [],
      branchId: "b1",
    });
    expect(available.map((r) => r.name)).toEqual(["101"]);
  });

  it("builds a clear conflict message with suggestions", () => {
    const conflict = evaluateRoomAssignmentConflict({
      roomId: "b",
      roomName: "102",
      roomStatus: "occupied",
      arrivalDate: "2026-10-01",
      departureDate: "2026-10-03",
      reservations: [],
      openStays: [],
      availableRoomNames: ["101", "103"],
    });
    expect(conflict?.kind).toBe("occupied");
    expect(conflict?.message).toContain("102 is currently occupied");
    expect(conflict?.message).toContain("Available: 101, 103");
  });

  it("formatConflictMessage omits Available when empty", () => {
    expect(formatConflictMessage("Conflict.")).toBe("Conflict.");
  });
});
