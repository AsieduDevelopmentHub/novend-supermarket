/**
 * Phase B dining — tables, open checks, modifiers, kitchen tickets.
 * Pay settles into immutable sales (commerce kernel).
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
import { rememberClientOp, replayClientOp } from "./shared/clientOps";
import type { MutationCtx } from "./_generated/server";

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

export type DiningModifierSnapshot = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
};

function parseModifiers(raw: string): DiningModifierSnapshot[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is DiningModifierSnapshot =>
        typeof row === "object" &&
        row !== null &&
        typeof (row as DiningModifierSnapshot).optionId === "string",
    );
  } catch {
    return [];
  }
}

function modifiersLabel(mods: DiningModifierSnapshot[]): string {
  return mods.map((m) => m.optionName).join(", ");
}

function lineUnitPrice(base: number, mods: DiningModifierSnapshot[]): number {
  return roundMoney(base + mods.reduce((sum, m) => sum + m.priceDelta, 0));
}

// --- Tables ---

export const listTables = query({
  args: { branchId: v.optional(v.id("branches")) },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const config = await loadBusinessConfiguration(ctx, organizationId);
    if (!hasBusinessCapability(config, "tables_orders")) return [];
    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);
    const rows = await ctx.db
      .query("diningTables")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    return rows
      .filter((t) => t.status === "active" && (!branchFilter || t.branchId === branchFilter))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  },
});

export const upsertTable = mutation({
  args: {
    tableId: v.optional(v.id("diningTables")),
    branchId: v.optional(v.id("branches")),
    name: v.string(),
    code: v.optional(v.string()),
    seats: v.optional(v.number()),
    sortOrder: v.optional(v.number()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
    ]);
    await requireBusinessCapability(ctx, organizationId, "tables_orders");

    let branchId = args.branchId ?? profile.branchId ?? null;
    if (!branchId) {
      const { findDefaultBranch, ensureDefaultBranch } = await import("./shared/defaultBranch");
      const existing = await findDefaultBranch(ctx, organizationId);
      branchId = existing?._id ?? (await ensureDefaultBranch(ctx, organizationId));
    }

    const branch = await ctx.db.get(branchId);
    assertActiveOrgBranch(branch, organizationId);
    if (profile.role === "manager" && profile.branchId !== branchId) {
      throw new Error("Forbidden: branch access denied");
    }
    const name = sanitizeText(args.name, "Table name", TEXT_LIMITS.name);
    const code = sanitizeOptionalText(args.code, "Code", TEXT_LIMITS.short);
    const now = Date.now();

    if (args.tableId) {
      const existing = await ctx.db.get(args.tableId);
      if (!existing || existing.organizationId !== organizationId) {
        throw new Error("Table not found");
      }
      await ctx.db.patch(args.tableId, {
        name,
        code: code ?? undefined,
        seats: args.seats,
        sortOrder: args.sortOrder,
        status: args.status ?? existing.status,
        updatedAt: now,
      });
      return { tableId: args.tableId };
    }

    const tableId = await ctx.db.insert("diningTables", {
      organizationId,
      branchId,
      name,
      code: code ?? undefined,
      seats: args.seats,
      sortOrder: args.sortOrder,
      status: args.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "dining_table_create",
      entityType: "diningTables",
      entityId: tableId,
      organizationId,
    });
    return { tableId };
  },
});

// --- Sessions ---

export const listOpenSessions = query({
  args: { branchId: v.optional(v.id("branches")) },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const config = await loadBusinessConfiguration(ctx, organizationId);
    if (!hasBusinessCapability(config, "tables_orders")) return [];
    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);
    const sessions = await ctx.db
      .query("diningSessions")
      .withIndex("by_organization_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", "open"),
      )
      .collect();
    return sessions.filter((s) => !branchFilter || s.branchId === branchFilter);
  },
});

export const getSession = query({
  args: { sessionId: v.id("diningSessions") },
  handler: async (ctx, args) => {
    const { organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    await requireBusinessCapability(ctx, organizationId, "tables_orders");
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.organizationId !== organizationId) return null;
    const table = await ctx.db.get(session.tableId);
    const items = await ctx.db
      .query("diningSessionItems")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();
    return {
      ...session,
      tableName: table?.name ?? "Table",
      items: items
        .filter((i) => i.kitchenStatus !== "void")
        .map((i) => ({
          ...i,
          modifiers: parseModifiers(i.modifiersJson),
        })),
    };
  },
});

export const openSession = mutation({
  args: {
    tableId: v.id("diningTables"),
    guestCount: v.optional(v.number()),
    clientOperationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    await requireBusinessCapability(ctx, organizationId, "tables_orders");

    if (args.clientOperationId?.trim()) {
      const replay = await replayClientOp(ctx, organizationId, args.clientOperationId.trim());
      if (replay) return replay as { sessionId: Id<"diningSessions"> };
    }

    const table = await ctx.db.get(args.tableId);
    if (!table || table.organizationId !== organizationId || table.status !== "active") {
      throw new Error("Table not found");
    }
    if (profile.role !== "administrator" && profile.branchId !== table.branchId) {
      throw new Error("Forbidden: branch access denied");
    }

    const openOnTable = await ctx.db
      .query("diningSessions")
      .withIndex("by_table", (q) => q.eq("tableId", table._id))
      .collect();
    if (openOnTable.some((s) => s.status === "open")) {
      throw new Error("This table already has an open check");
    }

    const sessionId = await ctx.db.insert("diningSessions", {
      organizationId,
      branchId: table.branchId,
      tableId: table._id,
      status: "open",
      openedBy: userId,
      openedAt: Date.now(),
      guestCount: args.guestCount,
    });

    const result = { sessionId };
    if (args.clientOperationId?.trim()) {
      await rememberClientOp(ctx, {
        organizationId,
        clientOperationId: args.clientOperationId.trim(),
        kind: "dining_open_session",
        result,
      });
    }
    return result;
  },
});

export const addSessionItem = mutation({
  args: {
    sessionId: v.id("diningSessions"),
    productId: v.id("products"),
    quantity: v.number(),
    discount: v.optional(v.number()),
    optionIds: v.optional(v.array(v.id("modifierOptions"))),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    await requireBusinessCapability(ctx, organizationId, "tables_orders");
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.organizationId !== organizationId || session.status !== "open") {
      throw new Error("Open check not found");
    }
    const product = await ctx.db.get(args.productId);
    if (
      !product ||
      product.organizationId !== organizationId ||
      product.status !== "active"
    ) {
      throw new Error("Product unavailable");
    }
    const qty = args.quantity;
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
      throw new Error("Invalid quantity");
    }
    const discount = roundMoney(args.discount ?? 0);
    assertPositiveMoney(discount, "line discount");

    const businessConfig = await loadBusinessConfiguration(ctx, organizationId);
    const modsEnabled = hasBusinessCapability(businessConfig, "modifiers");
    const snapshots: DiningModifierSnapshot[] = [];

    if (modsEnabled && args.optionIds?.length) {
      const groups = await ctx.db
        .query("modifierGroups")
        .withIndex("by_product", (q) => q.eq("productId", product._id))
        .collect();
      const activeGroups = groups.filter((g) => g.status === "active");
      for (const optionId of args.optionIds) {
        const option = await ctx.db.get(optionId);
        if (!option || option.organizationId !== organizationId || option.status !== "active") {
          throw new Error("Modifier option unavailable");
        }
        const group = activeGroups.find((g) => g._id === option.groupId);
        if (!group) throw new Error("Modifier does not belong to this product");
        snapshots.push({
          groupId: String(group._id),
          groupName: group.name,
          optionId: String(option._id),
          optionName: option.name,
          priceDelta: option.priceDelta,
        });
      }
      for (const group of activeGroups) {
        if (!group.required) continue;
        const selected = snapshots.filter((s) => s.groupId === String(group._id)).length;
        const min = group.minSelect ?? 1;
        if (selected < min) {
          throw new Error(`Choose at least ${min} option(s) for ${group.name}`);
        }
      }
    } else if (modsEnabled) {
      const groups = await ctx.db
        .query("modifierGroups")
        .withIndex("by_product", (q) => q.eq("productId", product._id))
        .collect();
      for (const group of groups.filter((g) => g.status === "active" && g.required)) {
        throw new Error(`Choose required options for ${group.name}`);
      }
    }

    const unitPrice = lineUnitPrice(product.sellingPrice, snapshots);
    const gross = roundMoney(unitPrice * qty);
    if (discount > gross) throw new Error("Discount exceeds line total");
    const lineTotal = roundMoney(gross - discount);
    const now = Date.now();

    return await ctx.db.insert("diningSessionItems", {
      organizationId,
      sessionId: session._id,
      productId: product._id,
      productName: product.name,
      quantity: qty,
      unitPrice,
      discount,
      lineTotal,
      modifiersJson: JSON.stringify(snapshots),
      kitchenStatus: "pending",
      note: sanitizeOptionalText(args.note, "Note", TEXT_LIMITS.short) ?? undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const voidSessionItem = mutation({
  args: { itemId: v.id("diningSessionItems") },
  handler: async (ctx, args) => {
    const { organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    await requireBusinessCapability(ctx, organizationId, "tables_orders");
    const item = await ctx.db.get(args.itemId);
    if (!item || item.organizationId !== organizationId) throw new Error("Line not found");
    const session = await ctx.db.get(item.sessionId);
    if (!session || session.status !== "open") throw new Error("Check is not open");
    await ctx.db.patch(args.itemId, { kitchenStatus: "void", updatedAt: Date.now() });
  },
});

// --- Kitchen ---

export const fireKitchenTicket = mutation({
  args: {
    sessionId: v.id("diningSessions"),
    itemIds: v.optional(v.array(v.id("diningSessionItems"))),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    await requireBusinessCapability(ctx, organizationId, "kitchen_tickets");
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.organizationId !== organizationId || session.status !== "open") {
      throw new Error("Open check not found");
    }
    const table = await ctx.db.get(session.tableId);
    const allItems = await ctx.db
      .query("diningSessionItems")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();
    const pending = allItems.filter((i) => {
      if (i.kitchenStatus !== "pending") return false;
      if (args.itemIds?.length) return args.itemIds.includes(i._id);
      return true;
    });
    if (pending.length === 0) throw new Error("No pending items to fire");

    const now = Date.now();
    const ticketId = await ctx.db.insert("kitchenTickets", {
      organizationId,
      branchId: session.branchId,
      sessionId: session._id,
      tableName: table?.name ?? "Table",
      status: "open",
      firedBy: userId,
      firedAt: now,
      updatedAt: now,
    });

    for (const item of pending) {
      const mods = parseModifiers(item.modifiersJson);
      await ctx.db.insert("kitchenTicketLines", {
        organizationId,
        ticketId,
        sessionItemId: item._id,
        productName: item.productName,
        quantity: item.quantity,
        modifiersLabel: modifiersLabel(mods) || undefined,
        note: item.note,
      });
      await ctx.db.patch(item._id, { kitchenStatus: "fired", updatedAt: now });
    }
    return { ticketId };
  },
});

export const listKitchenTickets = query({
  args: {
    branchId: v.optional(v.id("branches")),
    status: v.optional(
      v.union(v.literal("open"), v.literal("ready"), v.literal("done"), v.literal("void")),
    ),
  },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const config = await loadBusinessConfiguration(ctx, organizationId);
    if (!hasBusinessCapability(config, "kitchen_tickets")) return [];
    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);
    const tickets = await ctx.db
      .query("kitchenTickets")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const filtered = tickets
      .filter((t) => {
        if (branchFilter && t.branchId !== branchFilter) return false;
        if (args.status) return t.status === args.status;
        return t.status === "open" || t.status === "ready";
      })
      .sort((a, b) => a.firedAt - b.firedAt);

    const result = [];
    for (const ticket of filtered) {
      const lines = await ctx.db
        .query("kitchenTicketLines")
        .withIndex("by_ticket", (q) => q.eq("ticketId", ticket._id))
        .collect();
      result.push({ ...ticket, lines });
    }
    return result;
  },
});

export const updateKitchenTicketStatus = mutation({
  args: {
    ticketId: v.id("kitchenTickets"),
    status: v.union(
      v.literal("open"),
      v.literal("ready"),
      v.literal("done"),
      v.literal("void"),
    ),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    await requireBusinessCapability(ctx, organizationId, "kitchen_tickets");
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.organizationId !== organizationId) {
      throw new Error("Ticket not found");
    }
    const now = Date.now();
    await ctx.db.patch(args.ticketId, { status: args.status, updatedAt: now });
    if (args.status === "ready" || args.status === "done") {
      const lines = await ctx.db
        .query("kitchenTicketLines")
        .withIndex("by_ticket", (q) => q.eq("ticketId", ticket._id))
        .collect();
      const kitchenStatus = args.status === "ready" ? "ready" : "done";
      for (const line of lines) {
        const item = await ctx.db.get(line.sessionItemId);
        if (item && item.organizationId === organizationId && item.kitchenStatus !== "void") {
          await ctx.db.patch(item._id, { kitchenStatus, updatedAt: now });
        }
      }
    }
  },
});

// --- Modifiers ---

export const listModifierGroupsForProduct = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const { organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const product = await ctx.db.get(args.productId);
    if (!product || product.organizationId !== organizationId) return [];
    const config = await loadBusinessConfiguration(ctx, organizationId);
    if (!hasBusinessCapability(config, "modifiers")) return [];

    const groups = await ctx.db
      .query("modifierGroups")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();
    const active = groups.filter((g) => g.status === "active");
    const out = [];
    for (const group of active) {
      const options = (
        await ctx.db
          .query("modifierOptions")
          .withIndex("by_group", (q) => q.eq("groupId", group._id))
          .collect()
      ).filter((o) => o.status === "active");
      out.push({ ...group, options });
    }
    return out.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  },
});

export const upsertModifierGroup = mutation({
  args: {
    groupId: v.optional(v.id("modifierGroups")),
    productId: v.id("products"),
    name: v.string(),
    required: v.boolean(),
    minSelect: v.optional(v.number()),
    maxSelect: v.optional(v.number()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    await requireBusinessCapability(ctx, organizationId, "modifiers");
    const product = await ctx.db.get(args.productId);
    if (!product || product.organizationId !== organizationId) {
      throw new Error("Product not found");
    }
    const name = sanitizeText(args.name, "Group name", TEXT_LIMITS.name);
    const now = Date.now();
    if (args.groupId) {
      const existing = await ctx.db.get(args.groupId);
      if (!existing || existing.organizationId !== organizationId) {
        throw new Error("Group not found");
      }
      await ctx.db.patch(args.groupId, {
        name,
        required: args.required,
        minSelect: args.minSelect,
        maxSelect: args.maxSelect,
        sortOrder: args.sortOrder,
        updatedAt: now,
      });
      return args.groupId;
    }
    return await ctx.db.insert("modifierGroups", {
      organizationId,
      productId: args.productId,
      name,
      required: args.required,
      minSelect: args.minSelect,
      maxSelect: args.maxSelect,
      sortOrder: args.sortOrder,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const upsertModifierOption = mutation({
  args: {
    optionId: v.optional(v.id("modifierOptions")),
    groupId: v.id("modifierGroups"),
    name: v.string(),
    priceDelta: v.number(),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    await requireBusinessCapability(ctx, organizationId, "modifiers");
    const group = await ctx.db.get(args.groupId);
    if (!group || group.organizationId !== organizationId) {
      throw new Error("Group not found");
    }
    const name = sanitizeText(args.name, "Option name", TEXT_LIMITS.name);
    if (!Number.isFinite(args.priceDelta)) {
      throw new Error("Invalid price delta");
    }
    const now = Date.now();
    if (args.optionId) {
      const existing = await ctx.db.get(args.optionId);
      if (!existing || existing.organizationId !== organizationId) {
        throw new Error("Option not found");
      }
      await ctx.db.patch(args.optionId, {
        name,
        priceDelta: roundMoney(args.priceDelta),
        sortOrder: args.sortOrder,
        updatedAt: now,
      });
      return args.optionId;
    }
    return await ctx.db.insert("modifierOptions", {
      organizationId,
      groupId: args.groupId,
      name,
      priceDelta: roundMoney(args.priceDelta),
      sortOrder: args.sortOrder,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// --- Pay session → sale ---

export const paySession = mutation({
  args: {
    sessionId: v.id("diningSessions"),
    paymentMethod: v.union(v.literal("cash"), v.literal("card"), v.literal("mobile_money")),
    discount: v.optional(v.number()),
    customerName: v.optional(v.string()),
    clientOperationId: v.optional(v.string()),
    invoiceNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    await requireBusinessCapability(ctx, organizationId, "tables_orders");

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

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.organizationId !== organizationId || session.status !== "open") {
      throw new Error("Open check not found");
    }
    if (profile.role !== "administrator" && profile.branchId !== session.branchId) {
      throw new Error("Forbidden: branch access denied");
    }
    const branchId = session.branchId;

    const items = (
      await ctx.db
        .query("diningSessionItems")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect()
    ).filter((i) => i.kitchenStatus !== "void");
    if (items.length === 0) throw new Error("Check is empty");

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

    for (const item of items) {
      const product = await ctx.db.get(item.productId);
      if (!product || product.status !== "active") {
        throw new Error(`Product unavailable: ${item.productName}`);
      }
      if (productTracksInventory(product, businessConfig)) {
        const available = productTracksExpiry(product)
          ? await getSellableQuantity(ctx, branchId, product._id)
          : await getBranchQuantity(ctx, branchId, product._id);
        if (available < item.quantity) {
          throw new Error(`Not enough stock for ${product.name}. Available: ${available}.`);
        }
      }
      subtotal += item.lineTotal;
      itemCount += item.quantity;
      lines.push({
        productId: product._id,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: product.costPrice,
        discount: item.discount,
        lineTotal: item.lineTotal,
      });
    }

    const cartDiscount = roundMoney(args.discount ?? 0);
    assertPositiveMoney(cartDiscount, "cart discount");
    if (cartDiscount - roundMoney(subtotal) > 0.001) {
      throw new Error("Discount cannot exceed the sale subtotal");
    }
    const total = Math.max(0, roundMoney(subtotal - cartDiscount));
    const invoiceNumber = await nextInvoiceNumber(ctx, organizationId, args.invoiceNumber);
    const completedAt = Date.now();
    const snapshot = await loadPrintSnapshot(ctx, organizationId, branchId);
    const customerName = args.customerName?.trim() || "Walk-in Customer";

    const saleId = await ctx.db.insert("sales", {
      organizationId,
      invoiceNumber,
      cashierId: userId,
      branchId,
      customerId: undefined,
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
      customerPhone: null,
      customerId: null,
      cashierName: profile.name,
      cashierId: userId,
      business: snapshot.business,
      template: snapshot.template,
      source: "dining",
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

    await ctx.db.patch(session._id, {
      status: "closed",
      closedAt: completedAt,
      saleId,
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "dining_pay_session",
      entityType: "diningSessions",
      entityId: session._id,
      metadata: { saleId, invoiceNumber, total },
    });

    await bumpOrgSaleStats(ctx, organizationId, { revenue: total, completedAt });

    return { saleId, invoiceNumber, total, receiptPayload: payload };
  },
});
