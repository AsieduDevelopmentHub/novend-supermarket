/**
 * Offline hospitality actions — enqueue outbox + optimistic Dexie mirrors.
 * Uses the existing outbox/sync-engine; does not invent a second sync path.
 */

import {
  evaluateRoomAssignmentConflict,
  listAvailableRoomsForDates,
  millisToIsoDate,
} from "@/convex/shared/hotelReservations";
import { getOfflineDb, newClientId, type NovendOfflineDb } from "./db";
import { notifyReplicaChanged } from "./replica-events";
import {
  enqueueDiningOpenSession,
  enqueueDiningPaySession,
  enqueueHotelCheckIn,
  enqueueHotelCheckoutPay,
  enqueueOutbox,
} from "./outbox";
import type {
  MirroredDiningSession,
  MirroredDiningSessionItem,
  MirroredHotelFolioCharge,
  MirroredHotelReservation,
  MirroredHotelStay,
  MirroredKitchenTicket,
} from "./types";

export async function offlineOpenDiningSession(input: {
  tableId: string;
  tableName: string;
  branchId: string;
  openedBy: string;
  openedByName?: string | null;
  guestCount?: number;
}): Promise<{ sessionId: string; clientOperationId: string }> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage unavailable");
  const clientOperationId = newClientId("dining_open");
  const sessionId = newClientId("dining_session");
  const now = Date.now();
  const row: MirroredDiningSession = {
    id: sessionId,
    branchId: input.branchId,
    tableId: input.tableId,
    tableName: input.tableName,
    status: "open",
    openedBy: input.openedBy,
    openedByName: input.openedByName ?? null,
    openedAt: now,
    guestCount: input.guestCount ?? null,
    syncStatus: "pending",
  };
  await db.diningSessions.put(row);
  await enqueueDiningOpenSession(db, clientOperationId, {
    tableId: input.tableId,
    guestCount: input.guestCount,
  });
  notifyReplicaChanged();
  return { sessionId, clientOperationId };
}

export async function offlineAddDiningSessionItem(input: {
  sessionId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  optionIds?: string[];
  note?: string;
}): Promise<{ itemId: string; clientOperationId: string }> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage unavailable");
  const clientOperationId = newClientId("dining_add_item");
  const itemId = newClientId("dining_item");
  const qty = input.quantity;
  const discount = input.discount ?? 0;
  const lineTotal = Math.round((input.unitPrice * qty - discount) * 100) / 100;
  const now = Date.now();
  const row: MirroredDiningSessionItem = {
    id: itemId,
    sessionId: input.sessionId,
    productId: input.productId,
    productName: input.productName,
    quantity: qty,
    unitPrice: input.unitPrice,
    discount,
    lineTotal,
    modifiersJson: "[]",
    kitchenStatus: "pending",
    note: input.note ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.diningSessionItems.put(row);
  await enqueueOutbox(db, "dining_add_session_item", {
    sessionId: input.sessionId,
    productId: input.productId,
    quantity: qty,
    discount: input.discount,
    optionIds: input.optionIds,
    note: input.note,
    localItemId: itemId,
  }, clientOperationId);
  notifyReplicaChanged();
  return { itemId, clientOperationId };
}

export async function offlineFireKitchenTicket(input: {
  sessionId: string;
  tableName: string;
  branchId: string;
  itemIds?: string[];
}): Promise<{ ticketId: string; clientOperationId: string }> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage unavailable");
  const clientOperationId = newClientId("dining_fire");
  const ticketId = newClientId("kitchen_ticket");
  const items = await db.diningSessionItems.where("sessionId").equals(input.sessionId).toArray();
  const pending = items.filter((i) => {
    if (i.kitchenStatus !== "pending") return false;
    if (input.itemIds?.length) return input.itemIds.includes(i.id);
    return true;
  });
  if (pending.length === 0) throw new Error("No pending items to fire");
  const now = Date.now();
  const ticket: MirroredKitchenTicket = {
    id: ticketId,
    branchId: input.branchId,
    sessionId: input.sessionId,
    tableName: input.tableName,
    status: "open",
    firedAt: now,
    updatedAt: now,
    linesJson: JSON.stringify(
      pending.map((i) => ({
        id: i.id,
        productName: i.productName,
        quantity: i.quantity,
        modifiersLabel: null,
        note: i.note ?? null,
      })),
    ),
  };
  await db.kitchenTickets.put(ticket);
  for (const item of pending) {
    await db.diningSessionItems.put({
      ...item,
      kitchenStatus: "fired",
      updatedAt: now,
    });
  }
  await enqueueOutbox(
    db,
    "dining_fire_kitchen_ticket",
    {
      sessionId: input.sessionId,
      itemIds: input.itemIds,
      localTicketId: ticketId,
    },
    clientOperationId,
  );
  notifyReplicaChanged();
  return { ticketId, clientOperationId };
}

export async function offlinePayDiningSession(input: {
  sessionId: string;
  paymentMethod: "cash" | "card" | "mobile_money";
  discount?: number;
  customerName?: string;
}): Promise<{ clientOperationId: string }> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage unavailable");
  const clientOperationId = newClientId("dining_pay");
  const session = await db.diningSessions.get(input.sessionId);
  if (session) {
    await db.diningSessions.put({ ...session, status: "closed", syncStatus: "pending" });
  }
  await enqueueDiningPaySession(db, clientOperationId, input);
  notifyReplicaChanged();
  return { clientOperationId };
}

export async function offlineCreateReservation(input: {
  branchId: string;
  customerId: string;
  customerName: string;
  roomId?: string;
  roomName?: string | null;
  arrivalDate: string;
  departureDate: string;
  guests?: number;
  notes?: string;
  status?: "booked" | "confirmed";
}): Promise<{ reservationId: string; clientOperationId: string }> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage unavailable");

  if (input.departureDate <= input.arrivalDate) {
    throw new Error("Departure must be after arrival");
  }

  if (input.roomId) {
    const [rooms, reservations, stays] = await Promise.all([
      db.hotelRooms.where("branchId").equals(input.branchId).toArray(),
      db.hotelReservations.where("branchId").equals(input.branchId).toArray(),
      db.hotelStays.where("branchId").equals(input.branchId).toArray(),
    ]);
    const room = rooms.find((r) => r.id === input.roomId);
    if (!room || room.status === "inactive") {
      throw new Error("Room not found");
    }
    if (room.status === "maintenance") {
      throw new Error("Room is under maintenance");
    }

    const available = listAvailableRoomsForDates({
      rooms: rooms.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        branchId: r.branchId,
      })),
      arrivalDate: input.arrivalDate,
      departureDate: input.departureDate,
      reservations: reservations.map((r) => ({
        id: r.id,
        roomId: r.roomId,
        status: r.status,
        arrivalDate: r.arrivalDate,
        departureDate: r.departureDate,
      })),
      openStays: stays
        .filter((s) => s.status === "open")
        .map((s) => ({
          roomId: s.roomId,
          status: s.status,
          checkInDate: millisToIsoDate(s.checkInAt),
        })),
      branchId: input.branchId,
    });
    const availableNames = available.filter((r) => r.id !== input.roomId).map((r) => r.name);
    const conflict = evaluateRoomAssignmentConflict({
      roomId: room.id,
      roomName: room.name,
      roomStatus: room.status,
      arrivalDate: input.arrivalDate,
      departureDate: input.departureDate,
      reservations: reservations.map((r) => ({
        id: r.id,
        roomId: r.roomId,
        status: r.status,
        arrivalDate: r.arrivalDate,
        departureDate: r.departureDate,
      })),
      openStays: stays
        .filter((s) => s.status === "open")
        .map((s) => ({
          roomId: s.roomId,
          status: s.status,
          checkInDate: millisToIsoDate(s.checkInAt),
        })),
      availableRoomNames: availableNames,
    });
    if (conflict) {
      throw new Error(conflict.message);
    }
  }

  const clientOperationId = newClientId("hotel_reservation");
  const reservationId = newClientId("hotel_reservation");
  const now = Date.now();
  const row: MirroredHotelReservation = {
    id: reservationId,
    branchId: input.branchId,
    roomId: input.roomId ?? null,
    roomName: input.roomName ?? null,
    customerId: input.customerId,
    customerName: input.customerName,
    arrivalDate: input.arrivalDate,
    departureDate: input.departureDate,
    status: input.status ?? "booked",
    guests: input.guests ?? null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending",
  };
  await db.hotelReservations.put(row);
  await enqueueOutbox(
    db,
    "hotel_create_reservation",
    {
      branchId: input.branchId,
      customerId: input.customerId,
      roomId: input.roomId,
      arrivalDate: input.arrivalDate,
      departureDate: input.departureDate,
      guests: input.guests,
      notes: input.notes,
      status: input.status ?? "confirmed",
      localReservationId: reservationId,
    },
    clientOperationId,
  );
  notifyReplicaChanged();
  return { reservationId, clientOperationId };
}

export async function offlineHotelCheckIn(input: {
  roomId: string;
  roomName: string;
  branchId: string;
  customerId: string;
  customerName: string;
  reservationId?: string;
  notes?: string;
  checkedInBy: string;
  checkedInByName?: string | null;
}): Promise<{ stayId: string; clientOperationId: string }> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage unavailable");
  const clientOperationId = newClientId("hotel_check_in");
  const stayId = newClientId("hotel_stay");
  const now = Date.now();
  const stay: MirroredHotelStay = {
    id: stayId,
    branchId: input.branchId,
    roomId: input.roomId,
    roomName: input.roomName,
    customerId: input.customerId,
    customerName: input.customerName,
    reservationId: input.reservationId ?? null,
    status: "open",
    checkInAt: now,
    notes: input.notes ?? null,
    checkedInBy: input.checkedInBy,
    checkedInByName: input.checkedInByName ?? null,
    syncStatus: "pending",
  };
  await db.hotelStays.put(stay);
  const room = await db.hotelRooms.get(input.roomId);
  if (room) {
    await db.hotelRooms.put({ ...room, status: "occupied" });
  }
  if (input.reservationId) {
    const reservation = await db.hotelReservations.get(input.reservationId);
    if (reservation) {
      await db.hotelReservations.put({
        ...reservation,
        status: "checked_in",
        roomId: input.roomId,
        roomName: input.roomName,
        updatedAt: now,
      });
    }
  }
  await enqueueHotelCheckIn(db, clientOperationId, {
    roomId: input.roomId,
    customerId: input.customerId,
    reservationId: input.reservationId,
    notes: input.notes,
  });
  notifyReplicaChanged();
  return { stayId, clientOperationId };
}

export async function offlineAddFolioCharge(input: {
  stayId: string;
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  kind?: "room" | "product" | "other";
}): Promise<{ chargeId: string; clientOperationId: string }> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage unavailable");
  const clientOperationId = newClientId("hotel_charge");
  const chargeId = newClientId("hotel_charge");
  const discount = input.discount ?? 0;
  const lineTotal = Math.round((input.unitPrice * input.quantity - discount) * 100) / 100;
  const row: MirroredHotelFolioCharge = {
    id: chargeId,
    stayId: input.stayId,
    kind: input.kind ?? "product",
    productId: input.productId,
    description: input.description,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    discount,
    lineTotal,
    status: "open",
    createdAt: Date.now(),
  };
  await db.hotelFolioCharges.put(row);
  await enqueueOutbox(
    db,
    "hotel_add_folio_charge",
    {
      stayId: input.stayId,
      productId: input.productId,
      quantity: input.quantity,
      discount: input.discount,
      kind: input.kind,
      localChargeId: chargeId,
    },
    clientOperationId,
  );
  notifyReplicaChanged();
  return { chargeId, clientOperationId };
}

export async function offlineHotelCheckoutPay(input: {
  stayId: string;
  paymentMethod: "cash" | "card" | "mobile_money";
  discount?: number;
}): Promise<{ clientOperationId: string }> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage unavailable");
  const clientOperationId = newClientId("hotel_checkout");
  const stay = await db.hotelStays.get(input.stayId);
  if (stay) {
    await db.hotelStays.put({ ...stay, status: "closed", syncStatus: "pending" });
    const room = await db.hotelRooms.get(stay.roomId);
    if (room) {
      await db.hotelRooms.put({ ...room, status: "dirty" });
    }
  }
  await enqueueHotelCheckoutPay(db, clientOperationId, input);
  notifyReplicaChanged();
  return { clientOperationId };
}

/** After sync maps local ids → server ids. */
export async function rekeyHospitalityLocalId(
  db: NovendOfflineDb,
  fromId: string,
  toId: string,
) {
  if (!fromId || fromId === toId) return;
  const session = await db.diningSessions.get(fromId);
  if (session) {
    await db.diningSessions.delete(fromId);
    await db.diningSessions.put({ ...session, id: toId, syncStatus: "synced" });
    const items = await db.diningSessionItems.where("sessionId").equals(fromId).toArray();
    for (const item of items) {
      await db.diningSessionItems.put({ ...item, sessionId: toId });
    }
    const tickets = await db.kitchenTickets.where("sessionId").equals(fromId).toArray();
    for (const ticket of tickets) {
      await db.kitchenTickets.put({ ...ticket, sessionId: toId });
    }
  }
  const stay = await db.hotelStays.get(fromId);
  if (stay) {
    await db.hotelStays.delete(fromId);
    await db.hotelStays.put({ ...stay, id: toId, syncStatus: "synced" });
    const charges = await db.hotelFolioCharges.where("stayId").equals(fromId).toArray();
    for (const charge of charges) {
      await db.hotelFolioCharges.put({ ...charge, stayId: toId });
    }
  }
  const reservation = await db.hotelReservations.get(fromId);
  if (reservation) {
    await db.hotelReservations.delete(fromId);
    await db.hotelReservations.put({ ...reservation, id: toId, syncStatus: "synced" });
  }
}
