/**
 * Phase C hotel folio — rooms, reservations, stays, folio charges.
 * Checkout settles into immutable sales (commerce kernel).
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  requireBusinessCapability,
  requireRole,
  resolveBranchFilter,
} from "./shared/permissions";
import { writeAuditLog } from "./shared/audit";
import { assertActiveOrgBranch } from "./shared/tenancy";
import {
  assertPositiveMoney,
  roundMoney,
  sanitizeOptionalText,
  sanitizeText,
  TEXT_LIMITS,
} from "./shared/validation";
import { loadBusinessConfiguration, loadPrintSnapshot } from "./settings";
import { hasBusinessCapability } from "./shared/businessCapabilities";
import { productTracksInventory } from "./shared/productInventory";
import { applyBranchStockChange, getBranchQuantity } from "./shared/branchStock";
import { decreaseLots, getSellableQuantity, productTracksExpiry } from "./shared/lots";
import { allocateInvoiceNumber, sanitizeInvoiceNumber } from "./shared/documentReferences";
import { bumpOrgSaleStats } from "./shared/organizationStats";
import type { MutationCtx } from "./_generated/server";

const roomStatusValidator = v.union(
  v.literal("available"),
  v.literal("occupied"),
  v.literal("dirty"),
  v.literal("maintenance"),
  v.literal("inactive"),
);

const reservationStatusValidator = v.union(
  v.literal("booked"),
  v.literal("confirmed"),
  v.literal("checked_in"),
  v.literal("cancelled"),
  v.literal("no_show"),
);

async function nextInvoiceNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  requested?: string,
) {
  if (requested?.trim()) {
    const invoiceNumber = sanitizeInvoiceNumber(requested);
    const existing = await ctx.db
      .query("sales")
      .withIndex("by_organization_invoice", (q) =>
        q.eq("organizationId", organizationId).eq("invoiceNumber", invoiceNumber),
      )
      .unique();
    if (existing) throw new Error("This invoice number is already used");
    return invoiceNumber;
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const reference = allocateInvoiceNumber();
    const existing = await ctx.db
      .query("sales")
      .withIndex("by_organization_invoice", (q) =>
        q.eq("organizationId", organizationId).eq("invoiceNumber", reference),
      )
      .unique();
    if (!existing) return reference;
  }
  throw new Error("Could not allocate a unique invoice reference");
}

function assertIsoDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
}

export const listRooms = query({
  args: { branchId: v.optional(v.id("branches")) },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const config = await loadBusinessConfiguration(ctx, organizationId);
    if (!hasBusinessCapability(config, "rooms_folio")) return [];
    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);
    const rows = await ctx.db
      .query("hotelRooms")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    return rows
      .filter((r) => r.status !== "inactive" && (!branchFilter || r.branchId === branchFilter))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  },
});

export const upsertRoom = mutation({
  args: {
    roomId: v.optional(v.id("hotelRooms")),
    branchId: v.id("branches"),
    name: v.string(),
    roomType: v.optional(v.string()),
    defaultProductId: v.optional(v.id("products")),
    status: v.optional(roomStatusValidator),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
    ]);
    await requireBusinessCapability(ctx, organizationId, "rooms_folio");
    const branch = await ctx.db.get(args.branchId);
    assertActiveOrgBranch(branch, organizationId);
    if (profile.role !== "administrator" && profile.branchId !== args.branchId) {
      throw new Error("Forbidden: branch access denied");
    }

    const name = sanitizeText(args.name, "Room name", TEXT_LIMITS.name);
    const roomType = sanitizeOptionalText(args.roomType, "Room type", TEXT_LIMITS.name);
    const now = Date.now();

    if (args.defaultProductId) {
      const product = await ctx.db.get(args.defaultProductId);
      if (!product || product.organizationId !== organizationId || product.status !== "active") {
        throw new Error("Default room-rate product not found");
      }
    }

    if (args.roomId) {
      const existing = await ctx.db.get(args.roomId);
      if (!existing || existing.organizationId !== organizationId) {
        throw new Error("Room not found");
      }
      await ctx.db.patch(args.roomId, {
        name,
        roomType: roomType ?? undefined,
        defaultProductId: args.defaultProductId,
        status: args.status ?? existing.status,
        sortOrder: args.sortOrder ?? existing.sortOrder,
        updatedAt: now,
      });
      await writeAuditLog(ctx, {
        actorId: userId,
        action: "hotel_room_update",
        entityType: "hotelRooms",
        entityId: args.roomId,
      });
      return { roomId: args.roomId };
    }

    const roomId = await ctx.db.insert("hotelRooms", {
      organizationId,
      branchId: args.branchId,
      name,
      roomType: roomType ?? undefined,
      defaultProductId: args.defaultProductId,
      status: args.status ?? "available",
      sortOrder: args.sortOrder,
      createdAt: now,
      updatedAt: now,
    });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "hotel_room_create",
      entityType: "hotelRooms",
      entityId: roomId,
    });
    return { roomId };
  },
});

export const setRoomStatus = mutation({
  args: {
    roomId: v.id("hotelRooms"),
    status: roomStatusValidator,
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    await requireBusinessCapability(ctx, organizationId, "rooms_folio");
    const room = await ctx.db.get(args.roomId);
    if (!room || room.organizationId !== organizationId) throw new Error("Room not found");
    if (profile.role !== "administrator" && profile.branchId !== room.branchId) {
      throw new Error("Forbidden: branch access denied");
    }
    if (args.status === "available" || args.status === "dirty" || args.status === "maintenance") {
      const openStay = await ctx.db
        .query("hotelStays")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();
      if (openStay.some((s) => s.status === "open") && args.status !== "dirty") {
        // occupied stays keep room occupied unless marking dirty after checkout flow
      }
    }
    await ctx.db.patch(room._id, { status: args.status, updatedAt: Date.now() });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "hotel_room_status",
      entityType: "hotelRooms",
      entityId: room._id,
      metadata: { status: args.status },
    });
    return { ok: true as const };
  },
});

export const listReservations = query({
  args: {
    branchId: v.optional(v.id("branches")),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const config = await loadBusinessConfiguration(ctx, organizationId);
    if (!hasBusinessCapability(config, "reservations")) return [];
    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);
    const rows = await ctx.db
      .query("hotelReservations")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    const result = [];
    for (const row of rows) {
      if (branchFilter && row.branchId !== branchFilter) continue;
      if (args.fromDate && row.departureDate < args.fromDate) continue;
      if (args.toDate && row.arrivalDate > args.toDate) continue;
      if (row.status === "cancelled") continue;
      const customer = await ctx.db.get(row.customerId);
      const room = row.roomId ? await ctx.db.get(row.roomId) : null;
      result.push({
        ...row,
        customerName: customer?.name ?? "Guest",
        customerPhone: customer?.phone ?? null,
        roomName: room?.name ?? null,
      });
    }
    return result.sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));
  },
});

export const createReservation = mutation({
  args: {
    branchId: v.id("branches"),
    customerId: v.id("customers"),
    roomId: v.optional(v.id("hotelRooms")),
    arrivalDate: v.string(),
    departureDate: v.string(),
    guests: v.optional(v.number()),
    notes: v.optional(v.string()),
    status: v.optional(v.union(v.literal("booked"), v.literal("confirmed"))),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    await requireBusinessCapability(ctx, organizationId, "reservations");
    const branch = await ctx.db.get(args.branchId);
    assertActiveOrgBranch(branch, organizationId);
    if (profile.role !== "administrator" && profile.branchId !== args.branchId) {
      throw new Error("Forbidden: branch access denied");
    }
    assertIsoDate(args.arrivalDate, "Arrival date");
    assertIsoDate(args.departureDate, "Departure date");
    if (args.departureDate <= args.arrivalDate) {
      throw new Error("Departure must be after arrival");
    }
    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.organizationId !== organizationId || customer.status !== "active") {
      throw new Error("Customer not found");
    }
    if (args.roomId) {
      const room = await ctx.db.get(args.roomId);
      if (!room || room.organizationId !== organizationId || room.branchId !== args.branchId) {
        throw new Error("Room not found");
      }
    }
    const now = Date.now();
    const reservationId = await ctx.db.insert("hotelReservations", {
      organizationId,
      branchId: args.branchId,
      roomId: args.roomId,
      customerId: args.customerId,
      arrivalDate: args.arrivalDate,
      departureDate: args.departureDate,
      status: args.status ?? "booked",
      guests: args.guests && args.guests > 0 ? Math.floor(args.guests) : undefined,
      notes: sanitizeOptionalText(args.notes, "Notes", TEXT_LIMITS.note) ?? undefined,
      createdAt: now,
      updatedAt: now,
    });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "hotel_reservation_create",
      entityType: "hotelReservations",
      entityId: reservationId,
    });
    return { reservationId };
  },
});

export const updateReservationStatus = mutation({
  args: {
    reservationId: v.id("hotelReservations"),
    status: reservationStatusValidator,
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    await requireBusinessCapability(ctx, organizationId, "reservations");
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || reservation.organizationId !== organizationId) {
      throw new Error("Reservation not found");
    }
    if (profile.role !== "administrator" && profile.branchId !== reservation.branchId) {
      throw new Error("Forbidden: branch access denied");
    }
    if (reservation.status === "checked_in" && args.status !== "checked_in") {
      throw new Error("Checked-in reservations cannot change status here");
    }
    await ctx.db.patch(reservation._id, { status: args.status, updatedAt: Date.now() });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "hotel_reservation_status",
      entityType: "hotelReservations",
      entityId: reservation._id,
      metadata: { status: args.status },
    });
    return { ok: true as const };
  },
});

export const listOpenStays = query({
  args: { branchId: v.optional(v.id("branches")) },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const config = await loadBusinessConfiguration(ctx, organizationId);
    if (!hasBusinessCapability(config, "rooms_folio")) return [];
    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);
    const stays = await ctx.db
      .query("hotelStays")
      .withIndex("by_organization_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", "open"),
      )
      .collect();
    const result = [];
    for (const stay of stays) {
      if (branchFilter && stay.branchId !== branchFilter) continue;
      const room = await ctx.db.get(stay.roomId);
      const customer = await ctx.db.get(stay.customerId);
      result.push({
        ...stay,
        roomName: room?.name ?? "Room",
        customerName: customer?.name ?? "Guest",
      });
    }
    return result;
  },
});

export const getStay = query({
  args: { stayId: v.id("hotelStays") },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const config = await loadBusinessConfiguration(ctx, organizationId);
    if (!hasBusinessCapability(config, "rooms_folio")) return null;
    const stay = await ctx.db.get(args.stayId);
    if (!stay || stay.organizationId !== organizationId) return null;
    if (profile.role !== "administrator" && profile.branchId !== stay.branchId) {
      throw new Error("Forbidden: branch access denied");
    }
    const room = await ctx.db.get(stay.roomId);
    const customer = await ctx.db.get(stay.customerId);
    const charges = await ctx.db
      .query("hotelFolioCharges")
      .withIndex("by_stay", (q) => q.eq("stayId", stay._id))
      .collect();
    const openCharges = charges.filter((c) => c.status === "open");
    const folioTotal = openCharges.reduce((sum, c) => sum + c.lineTotal, 0);
    return {
      ...stay,
      roomName: room?.name ?? "Room",
      roomType: room?.roomType ?? null,
      defaultProductId: room?.defaultProductId ?? null,
      customerName: customer?.name ?? "Guest",
      customerPhone: customer?.phone ?? null,
      charges: charges.sort((a, b) => a.createdAt - b.createdAt),
      folioTotal: roundMoney(folioTotal),
    };
  },
});

export const checkIn = mutation({
  args: {
    roomId: v.id("hotelRooms"),
    customerId: v.id("customers"),
    reservationId: v.optional(v.id("hotelReservations")),
    notes: v.optional(v.string()),
    clientOperationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    await requireBusinessCapability(ctx, organizationId, "rooms_folio");

    const room = await ctx.db.get(args.roomId);
    if (!room || room.organizationId !== organizationId || room.status === "inactive") {
      throw new Error("Room not found");
    }
    if (profile.role !== "administrator" && profile.branchId !== room.branchId) {
      throw new Error("Forbidden: branch access denied");
    }
    if (room.status === "occupied") {
      throw new Error("Room is already occupied");
    }
    if (room.status === "maintenance") {
      throw new Error("Room is under maintenance");
    }

    const openOnRoom = (
      await ctx.db
        .query("hotelStays")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect()
    ).find((s) => s.status === "open");
    if (openOnRoom) throw new Error("Room already has an open stay");

    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.organizationId !== organizationId || customer.status !== "active") {
      throw new Error("Customer not found");
    }

    if (args.reservationId) {
      await requireBusinessCapability(ctx, organizationId, "reservations");
      const reservation = await ctx.db.get(args.reservationId);
      if (!reservation || reservation.organizationId !== organizationId) {
        throw new Error("Reservation not found");
      }
      if (reservation.status === "cancelled" || reservation.status === "checked_in") {
        throw new Error("Reservation cannot be checked in");
      }
      if (reservation.customerId !== args.customerId) {
        throw new Error("Guest does not match reservation");
      }
    }

    const now = Date.now();
    const stayId = await ctx.db.insert("hotelStays", {
      organizationId,
      branchId: room.branchId,
      roomId: room._id,
      customerId: args.customerId,
      reservationId: args.reservationId,
      status: "open",
      checkInAt: now,
      notes: sanitizeOptionalText(args.notes, "Notes", TEXT_LIMITS.note) ?? undefined,
      checkedInBy: userId,
    });

    await ctx.db.patch(room._id, { status: "occupied", updatedAt: now });

    if (args.reservationId) {
      await ctx.db.patch(args.reservationId, {
        status: "checked_in",
        updatedAt: now,
        roomId: room._id,
      });
    }

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "hotel_check_in",
      entityType: "hotelStays",
      entityId: stayId,
      metadata: { roomId: room._id, reservationId: args.reservationId },
    });

    return { stayId };
  },
});

export const addFolioCharge = mutation({
  args: {
    stayId: v.id("hotelStays"),
    kind: v.union(v.literal("room"), v.literal("product"), v.literal("other")),
    productId: v.id("products"),
    description: v.optional(v.string()),
    quantity: v.number(),
    unitPrice: v.optional(v.number()),
    discount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    await requireBusinessCapability(ctx, organizationId, "rooms_folio");
    const stay = await ctx.db.get(args.stayId);
    if (!stay || stay.organizationId !== organizationId || stay.status !== "open") {
      throw new Error("Open stay not found");
    }
    if (profile.role !== "administrator" && profile.branchId !== stay.branchId) {
      throw new Error("Forbidden: branch access denied");
    }
    const product = await ctx.db.get(args.productId);
    if (!product || product.organizationId !== organizationId || product.status !== "active") {
      throw new Error("Product not found");
    }
    const quantity = args.quantity;
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Quantity must be positive");
    const unitPrice = roundMoney(args.unitPrice ?? product.sellingPrice);
    assertPositiveMoney(unitPrice, "unit price");
    const discount = roundMoney(args.discount ?? 0);
    assertPositiveMoney(discount, "discount");
    const lineTotal = Math.max(0, roundMoney(unitPrice * quantity - discount));
    const description =
      sanitizeOptionalText(args.description, "Description", TEXT_LIMITS.name) ?? product.name;

    const chargeId = await ctx.db.insert("hotelFolioCharges", {
      organizationId,
      stayId: stay._id,
      kind: args.kind,
      productId: product._id,
      description,
      quantity,
      unitPrice,
      discount,
      lineTotal,
      status: "open",
      createdAt: Date.now(),
      createdBy: userId,
    });
    return { chargeId };
  },
});

export const voidFolioCharge = mutation({
  args: { chargeId: v.id("hotelFolioCharges") },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    await requireBusinessCapability(ctx, organizationId, "rooms_folio");
    const charge = await ctx.db.get(args.chargeId);
    if (!charge || charge.organizationId !== organizationId) throw new Error("Charge not found");
    const stay = await ctx.db.get(charge.stayId);
    if (!stay || stay.status !== "open") throw new Error("Stay is not open");
    if (profile.role !== "administrator" && profile.branchId !== stay.branchId) {
      throw new Error("Forbidden: branch access denied");
    }
    await ctx.db.patch(charge._id, { status: "void" });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "hotel_folio_void",
      entityType: "hotelFolioCharges",
      entityId: charge._id,
    });
    return { ok: true as const };
  },
});

export const postRoomNight = mutation({
  args: {
    stayId: v.id("hotelStays"),
    nights: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    await requireBusinessCapability(ctx, organizationId, "rooms_folio");
    const stay = await ctx.db.get(args.stayId);
    if (!stay || stay.organizationId !== organizationId || stay.status !== "open") {
      throw new Error("Open stay not found");
    }
    if (profile.role !== "administrator" && profile.branchId !== stay.branchId) {
      throw new Error("Forbidden: branch access denied");
    }
    const room = await ctx.db.get(stay.roomId);
    if (!room?.defaultProductId) {
      throw new Error("Set a default room-rate product on this room first");
    }
    const product = await ctx.db.get(room.defaultProductId);
    if (!product || product.status !== "active") {
      throw new Error("Room-rate product unavailable");
    }
    const nights = Math.max(1, Math.floor(args.nights ?? 1));
    const unitPrice = roundMoney(product.sellingPrice);
    const lineTotal = roundMoney(unitPrice * nights);
    const chargeId = await ctx.db.insert("hotelFolioCharges", {
      organizationId,
      stayId: stay._id,
      kind: "room",
      productId: product._id,
      description: `${room.name} — ${nights} night${nights === 1 ? "" : "s"}`,
      quantity: nights,
      unitPrice,
      discount: 0,
      lineTotal,
      status: "open",
      createdAt: Date.now(),
      createdBy: userId,
    });
    return { chargeId };
  },
});

export const checkoutPay = mutation({
  args: {
    stayId: v.id("hotelStays"),
    paymentMethod: v.union(v.literal("cash"), v.literal("card"), v.literal("mobile_money")),
    discount: v.optional(v.number()),
    clientOperationId: v.optional(v.string()),
    invoiceNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    await requireBusinessCapability(ctx, organizationId, "rooms_folio");

    if (args.clientOperationId?.trim()) {
      const existing = await ctx.db
        .query("saleClientOps")
        .withIndex("by_organization_clientOperationId", (q) =>
          q
            .eq("organizationId", organizationId)
            .eq("clientOperationId", args.clientOperationId!.trim()),
        )
        .unique();
      if (existing) {
        const sale = await ctx.db.get(existing.saleId);
        if (sale) {
          return {
            saleId: sale._id,
            invoiceNumber: sale.invoiceNumber,
            total: sale.total,
          };
        }
      }
    }

    const stay = await ctx.db.get(args.stayId);
    if (!stay || stay.organizationId !== organizationId || stay.status !== "open") {
      throw new Error("Open stay not found");
    }
    if (profile.role !== "administrator" && profile.branchId !== stay.branchId) {
      throw new Error("Forbidden: branch access denied");
    }
    const branchId = stay.branchId;
    const room = await ctx.db.get(stay.roomId);
    const customer = await ctx.db.get(stay.customerId);

    const charges = (
      await ctx.db
        .query("hotelFolioCharges")
        .withIndex("by_stay", (q) => q.eq("stayId", stay._id))
        .collect()
    ).filter((c) => c.status === "open");
    if (charges.length === 0) throw new Error("Folio has no open charges");

    const businessConfig = await loadBusinessConfiguration(ctx, organizationId);
    let subtotal = 0;
    let itemCount = 0;
    const lines: Array<{
      productId: Id<"products">;
      productName: string;
      quantity: number;
      unitPrice: number;
      unitCost: number;
      discount: number;
      lineTotal: number;
    }> = [];

    for (const charge of charges) {
      const product = await ctx.db.get(charge.productId);
      if (!product || product.status !== "active") {
        throw new Error(`Product unavailable: ${charge.description}`);
      }
      if (productTracksInventory(product, businessConfig)) {
        const available = productTracksExpiry(product)
          ? await getSellableQuantity(ctx, branchId, product._id)
          : await getBranchQuantity(ctx, branchId, product._id);
        if (available < charge.quantity) {
          throw new Error(`Not enough stock for ${product.name}. Available: ${available}.`);
        }
      }
      subtotal += charge.lineTotal;
      itemCount += charge.quantity;
      lines.push({
        productId: product._id,
        productName: charge.description || product.name,
        quantity: charge.quantity,
        unitPrice: charge.unitPrice,
        unitCost: product.costPrice,
        discount: charge.discount,
        lineTotal: charge.lineTotal,
      });
    }

    const cartDiscount = roundMoney(args.discount ?? 0);
    assertPositiveMoney(cartDiscount, "cart discount");
    if (cartDiscount - roundMoney(subtotal) > 0.001) {
      throw new Error("Discount cannot exceed the folio subtotal");
    }
    const total = Math.max(0, roundMoney(subtotal - cartDiscount));
    const invoiceNumber = await nextInvoiceNumber(ctx, organizationId, args.invoiceNumber);
    const completedAt = Date.now();
    const snapshot = await loadPrintSnapshot(ctx, organizationId, branchId);
    const customerName = customer?.name?.trim() || "Walk-in Guest";

    const saleId = await ctx.db.insert("sales", {
      organizationId,
      invoiceNumber,
      cashierId: userId,
      branchId,
      customerId: stay.customerId,
      customerName,
      subtotal: roundMoney(subtotal),
      discount: cartDiscount,
      total,
      paymentMethod: args.paymentMethod,
      itemCount,
      status: "completed",
      completedAt,
    });

    for (const line of lines) {
      const saleItemId = await ctx.db.insert("saleItems", {
        organizationId,
        saleId,
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        unitCost: line.unitCost,
        discount: line.discount,
        lineTotal: line.lineTotal,
      });
      const product = await ctx.db.get(line.productId);
      if (!product || !productTracksInventory(product, businessConfig)) continue;
      if (productTracksExpiry(product)) {
        const allocations = await decreaseLots(ctx, {
          branchId,
          productId: line.productId,
          quantity: line.quantity,
          reason: "sale",
          sellableOnly: true,
          productName: line.productName,
          performedBy: userId,
          relatedSaleId: saleId,
        });
        for (const allocation of allocations) {
          await ctx.db.insert("saleItemLots", {
            organizationId,
            saleItemId,
            lotId: allocation.lotId,
            quantity: allocation.quantity,
            expiryDate: allocation.expiryDate,
          });
        }
      } else {
        await applyBranchStockChange(ctx, {
          branchId,
          productId: line.productId,
          quantityChange: -line.quantity,
          reason: "sale",
          performedBy: userId,
          relatedSaleId: saleId,
        });
      }
    }

    const payload = {
      invoiceNumber,
      saleId,
      branchId,
      subtotal: roundMoney(subtotal),
      discount: cartDiscount,
      total,
      itemCount,
      lines,
      paymentMethod: args.paymentMethod,
      completedAt,
      customerName,
      customerPhone: customer?.phone ?? null,
      customerId: stay.customerId,
      cashierName: profile.name,
      cashierId: userId,
      business: snapshot.business,
      template: snapshot.template,
      source: "hotel_folio",
      roomName: room?.name ?? null,
    };

    await ctx.db.insert("receipts", {
      organizationId,
      saleId,
      invoiceNumber,
      payload: JSON.stringify(payload),
      createdAt: completedAt,
    });

    if (args.clientOperationId?.trim()) {
      await ctx.db.insert("saleClientOps", {
        organizationId,
        clientOperationId: args.clientOperationId.trim(),
        saleId,
        cashierId: userId,
        createdAt: completedAt,
      });
    }

    await ctx.db.patch(stay._id, {
      status: "closed",
      checkOutAt: completedAt,
      saleId,
    });
    if (room) {
      await ctx.db.patch(room._id, { status: "dirty", updatedAt: completedAt });
    }

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "hotel_checkout_pay",
      entityType: "hotelStays",
      entityId: stay._id,
      metadata: { saleId, invoiceNumber, total },
    });

    await bumpOrgSaleStats(ctx, organizationId, { revenue: total, completedAt });

    return { saleId, invoiceNumber, total, receiptPayload: payload };
  },
});
