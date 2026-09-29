/**
 * Unified open operations for Orders — table checks, folios, active reservations.
 * These are operational records, not completed sales.
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireRole, resolveBranchFilter } from "./shared/permissions";
import { loadBusinessConfiguration } from "./settings";
import { hasBusinessCapability } from "./shared/businessCapabilities";

const ARRIVING_SOON_DAYS = 14;

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoPlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function diningSource(industryProfile: string | undefined) {
  return industryProfile === "bar" ? ("bar_tab" as const) : ("restaurant_table" as const);
}

function shortReservationRef(id: string) {
  return `#${id.slice(-6).toUpperCase()}`;
}

export const listOpenOperations = query({
  args: {
    branchId: v.optional(v.id("branches")),
    includeReservations: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const config = await loadBusinessConfiguration(ctx, organizationId);
    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);
    const includeReservations = args.includeReservations !== false;
    const sourceDining = diningSource(config.industryProfile);

    const branches = await ctx.db
      .query("branches")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const branchNameById = new Map(branches.map((b) => [String(b._id), b.name]));

    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const nameByUser = new Map(profiles.map((p) => [String(p.userId), p.name]));

    type Row = {
      id: string;
      kind: "dining_session" | "hotel_stay" | "hotel_reservation";
      source: "restaurant_table" | "bar_tab" | "room_folio" | "reservation";
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

    const rows: Row[] = [];

    if (hasBusinessCapability(config, "tables_orders")) {
      const sessions = await ctx.db
        .query("diningSessions")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "open"),
        )
        .collect();

      for (const session of sessions) {
        if (branchFilter && session.branchId !== branchFilter) continue;
        const table = await ctx.db.get(session.tableId);
        const items = await ctx.db
          .query("diningSessionItems")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();
        const openItems = items.filter((i) => i.kitchenStatus !== "void");
        const tickets = await ctx.db
          .query("kitchenTickets")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();
        const kitchenOpenCount = tickets.filter((t) => t.status === "open").length;
        const kitchenReadyCount = tickets.filter((t) => t.status === "ready").length;
        const total = openItems.reduce((sum, i) => sum + i.lineTotal, 0);
        let fulfilmentStatus: string | null = "Open";
        if (kitchenReadyCount > 0) fulfilmentStatus = "Ready";
        else if (kitchenOpenCount > 0) fulfilmentStatus = "Preparing";

        const tableName = table?.name?.trim() || "Table";
        rows.push({
          id: String(session._id),
          kind: "dining_session",
          source: sourceDining,
          originLabel: `Table ${tableName}`,
          status: session.status,
          paymentStatus: "unpaid",
          fulfilmentStatus,
          branchId: String(session.branchId),
          branchName: branchNameById.get(String(session.branchId)) ?? null,
          openedAt: session.openedAt,
          total,
          itemCount: openItems.length,
          guestLabel: session.guestCount ? `${session.guestCount} guests` : null,
          serverName: nameByUser.get(String(session.openedBy)) ?? null,
          kitchenOpenCount,
          kitchenReadyCount,
          href: "/floor",
        });
      }
    }

    if (hasBusinessCapability(config, "rooms_folio")) {
      const stays = await ctx.db
        .query("hotelStays")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "open"),
        )
        .collect();

      for (const stay of stays) {
        if (branchFilter && stay.branchId !== branchFilter) continue;
        const room = await ctx.db.get(stay.roomId);
        const customer = await ctx.db.get(stay.customerId);
        const charges = await ctx.db
          .query("hotelFolioCharges")
          .withIndex("by_stay", (q) => q.eq("stayId", stay._id))
          .collect();
        const openCharges = charges.filter((c) => c.status === "open");
        const total = openCharges.reduce((sum, c) => sum + c.lineTotal, 0);
        const roomName = room?.name?.trim() || "Room";
        rows.push({
          id: String(stay._id),
          kind: "hotel_stay",
          source: "room_folio",
          originLabel: `Room ${roomName}`,
          status: stay.status,
          paymentStatus: "unpaid",
          fulfilmentStatus: null,
          branchId: String(stay.branchId),
          branchName: branchNameById.get(String(stay.branchId)) ?? null,
          openedAt: stay.checkInAt,
          total,
          itemCount: openCharges.length,
          guestLabel: customer?.name ?? null,
          serverName: nameByUser.get(String(stay.checkedInBy)) ?? null,
          kitchenOpenCount: 0,
          kitchenReadyCount: 0,
          href: "/rooms",
        });
      }
    }

    if (includeReservations && hasBusinessCapability(config, "reservations")) {
      const today = isoToday();
      const until = isoPlusDays(ARRIVING_SOON_DAYS);
      const reservations = await ctx.db
        .query("hotelReservations")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();

      for (const reservation of reservations) {
        if (branchFilter && reservation.branchId !== branchFilter) continue;
        if (reservation.status !== "booked" && reservation.status !== "confirmed") continue;
        if (reservation.departureDate < today) continue;
        if (reservation.arrivalDate > until) continue;
        const customer = await ctx.db.get(reservation.customerId);
        const room = reservation.roomId ? await ctx.db.get(reservation.roomId) : null;
        const ref = shortReservationRef(String(reservation._id));
        const roomPart = room?.name ? ` · Room ${room.name}` : "";
        rows.push({
          id: String(reservation._id),
          kind: "hotel_reservation",
          source: "reservation",
          originLabel: `Reservation ${ref}${roomPart}`,
          status: reservation.status,
          paymentStatus: "unpaid",
          fulfilmentStatus: null,
          branchId: String(reservation.branchId),
          branchName: branchNameById.get(String(reservation.branchId)) ?? null,
          openedAt: reservation.createdAt,
          total: 0,
          itemCount: 0,
          guestLabel: customer?.name ?? null,
          serverName: null,
          kitchenOpenCount: 0,
          kitchenReadyCount: 0,
          href: "/reservations",
        });
      }
    }

    return rows.sort((a, b) => b.openedAt - a.openedAt);
  },
});
