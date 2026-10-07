import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireBranchId, canViewCostPrice, isAdmin } from "./shared/permissions";
import { loadPrintSnapshot, loadBusinessConfiguration, loadProductImagesPolicy, loadExpiryPolicy, loadResolvedBusinessTerms } from "./settings";
import { stockMapForBranch } from "./shared/branchStock";
import {
  deriveExpiryListFields,
  lotSummaries,
  productExpiryAlertDays,
} from "./shared/lots";
import { presenceFromLastSeenAt } from "./shared/presence";
import { loadTourProgressForUser } from "./shared/tourProgress";
import { hasBusinessCapability } from "./shared/businessCapabilities";
import { purchaseBalance } from "./shared/supplierFinance";

/**
 * Compact catalog snapshot for Dexie offline mirror.
 * Product rows carry catalog metadata; branchStock carries per-branch quantities.
 * Administrators receive stock for every branch (offline branch switching on Sales).
 * Includes cost prices for local sale line snapshots; cashiers must not display cost in UI.
 *
 * Tuned for bandwidth: indexed status filters, recent orders only (not full sales table).
 */
export const getSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const { userId, profile, branchId, organizationId } = await requireBranchId(ctx);
    if (
      profile.role !== "administrator" &&
      profile.role !== "manager" &&
      profile.role !== "cashier"
    ) {
      throw new Error("Forbidden");
    }
    const now = Date.now();

    const [
      categories,
      activeProducts,
      activeCustomers,
      stockByProduct,
      branches,
      profiles,
    ] = await Promise.all([
      ctx.db
        .query("categories")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect(),
      ctx.db
        .query("products")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "active"),
        )
        .collect(),
      ctx.db
        .query("customers")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "active"),
        )
        .collect(),
      stockMapForBranch(ctx, branchId),
      ctx.db
        .query("branches")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect(),
      ctx.db
        .query("profiles")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect(),
    ]);

    const expiryPolicy = await loadExpiryPolicy(ctx, profile.organizationId);
    const orgAlertDays = expiryPolicy.defaultAlertDays;
    const alertDaysByProduct = new Map(
      activeProducts.map((p) => [String(p._id), productExpiryAlertDays(p, orgAlertDays)]),
    );
    const summaries = await lotSummaries(ctx, branchId, undefined, alertDaysByProduct);

    const categoryMap = new Map(categories.map((c) => [c._id, c.name]));
    const showCost = canViewCostPrice(profile);
    const nameByUser = new Map(profiles.map((p) => [p.userId, p.name]));
    const branchNameById = new Map(branches.map((b) => [b._id, b.name]));

    const stockBranchIds = isAdmin(profile) ? branches.map((b) => b._id) : [branchId];

    const branchStockRows: Array<{
      id: string;
      branchId: string;
      productId: string;
      quantity: number;
      sellableQuantity: number;
      expiredQuantity?: number;
      expiringQuantity?: number;
      isExpiring?: boolean;
      updatedAt: number;
    }> = [];

    for (const stockBranchId of stockBranchIds) {
      const [branchStockMap, branchLotSummaries] = await Promise.all([
        stockMapForBranch(ctx, stockBranchId),
        lotSummaries(ctx, stockBranchId, undefined, alertDaysByProduct),
      ]);
      for (const product of activeProducts) {
        const quantity = branchStockMap.get(product._id) ?? 0;
        const expiry = deriveExpiryListFields(
          product,
          quantity,
          branchLotSummaries.get(product._id),
          orgAlertDays,
        );
        branchStockRows.push({
          id: `${stockBranchId}:${product._id}`,
          branchId: stockBranchId as string,
          productId: product._id as string,
          quantity,
          sellableQuantity: expiry.sellableQuantity,
          expiredQuantity: expiry.expiredQuantity,
          expiringQuantity: expiry.expiringQuantity,
          isExpiring: expiry.isExpiring,
          updatedAt: now,
        });
      }
    }

    const mirroredProducts = await Promise.all(
      activeProducts.map(async (product) => {
        const stockQuantity = stockByProduct.get(product._id) ?? 0;
        const expiry = deriveExpiryListFields(
          product,
          stockQuantity,
          summaries.get(product._id),
          orgAlertDays,
        );
        return {
          id: product._id as string,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode ?? null,
          categoryId: product.categoryId as string,
          categoryName: categoryMap.get(product.categoryId) ?? "Uncategorized",
          sellingPrice: product.sellingPrice,
          // Cashiers must not receive cost prices even in the offline mirror.
          costPrice: showCost ? product.costPrice : 0,
          stockQuantity,
          sellableQuantity: expiry.sellableQuantity,
          expiredQuantity: expiry.expiredQuantity,
          expiringQuantity: expiry.expiringQuantity,
          unit: product.unit,
          sellUnits: product.sellUnits ?? null,
          pricingMode: product.pricingMode ?? null,
          lowStockThreshold: product.lowStockThreshold,
          status: product.status as "active" | "inactive" | "archived",
          description: product.description ?? null,
          imageUrl: product.imageStorageId
            ? await ctx.storage.getUrl(product.imageStorageId)
            : null,
          tracksExpiry: expiry.tracksExpiry,
          tracksInventory: product.tracksInventory !== false,
          // Raw override only — resolve against snapshot.expiryPolicy offline.
          expiryAlertDays:
            typeof product.expiryAlertDays === "number" ? product.expiryAlertDays : null,
          nearestExpiry: expiry.nearestExpiry,
          isExpired: expiry.isExpired,
          isExpiring: expiry.isExpiring,
          updatedAt: now,
        };
      }),
    );

    // Recent completed sales only — avoid loading the entire sales table into the snapshot.
    const recentSales = await ctx.db
      .query("sales")
      .withIndex("by_organization_completedAt", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .take(400);

    let orderSales = recentSales.filter((s) => s.status === "completed");
    if (profile.role === "cashier") {
      orderSales = orderSales.filter((s) => s.cashierId === userId);
    } else if (profile.role === "manager") {
      orderSales = orderSales.filter((s) => s.branchId === branchId);
    }
    const saleIds = orderSales.slice(0, 200).map((sale) => sale._id);
    const refundedBySale = new Map<string, number>();
    const returnedByItem = new Map<string, number>();
    if (saleIds.length > 0) {
      const returnRows = await ctx.db
        .query("saleReturns")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
      const relevant = returnRows.filter(
        (row) => row.status === "completed" && saleIds.includes(row.saleId),
      );
      for (const row of relevant) {
        refundedBySale.set(row.saleId, (refundedBySale.get(row.saleId) ?? 0) + row.refundAmount);
        const returnItems = await ctx.db
          .query("saleReturnItems")
          .withIndex("by_return", (q) => q.eq("returnId", row._id))
          .collect();
        for (const item of returnItems) {
          returnedByItem.set(
            item.saleItemId,
            (returnedByItem.get(item.saleItemId) ?? 0) + item.quantity,
          );
        }
      }
    }

    const mirroredOrders = orderSales.slice(0, 200).map((sale) => ({
      id: sale._id as string,
      invoiceNumber: sale.invoiceNumber,
      customerId: (sale.customerId as string | undefined) ?? null,
      customerName: sale.customerName,
      cashierId: sale.cashierId as string,
      cashierName: nameByUser.get(sale.cashierId) ?? "Cashier",
      itemCount: sale.itemCount,
      subtotal: sale.subtotal,
      discount: sale.discount,
      total: sale.total,
      refundedAmount: refundedBySale.get(sale._id) ?? 0,
      paymentMethod: sale.paymentMethod as "cash" | "card" | "mobile_money",
      status: sale.status,
      completedAt: sale.completedAt,
      branchId: (sale.branchId as string | undefined) ?? null,
      branchName: sale.branchId ? (branchNameById.get(sale.branchId) ?? null) : null,
    }));

    const orderItems = [];
    for (const sale of orderSales.slice(0, 200)) {
      const items = await ctx.db
        .query("saleItems")
        .withIndex("by_sale", (q) => q.eq("saleId", sale._id))
        .collect();
      for (const item of items) {
        orderItems.push({
          id: item._id as string,
          orderId: sale._id as string,
          productId: item.productId as string,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          lineTotal: item.lineTotal,
          returnedQuantity: returnedByItem.get(item._id) ?? 0,
        });
      }
    }

    // Purchase stats from the recent window (same window as mirrored orders).
    const completedInWindow = recentSales.filter((s) => s.status === "completed");
    const customers = activeCustomers.map((c) => {
      const customerSales = completedInWindow
        .filter((s) => s.customerId === c._id)
        .sort((a, b) => b.completedAt - a.completedAt);
      const last = customerSales[0];
      return {
        id: c._id as string,
        name: c.name,
        phone: c.phone ?? null,
        email: c.email ?? null,
        notes: c.notes ?? null,
        status: c.status as "active" | "inactive",
        purchaseCount: customerSales.length,
        lastPurchaseAt: last?.completedAt ?? null,
        lastPurchaseTotal: last?.total ?? null,
        lastInvoiceNumber: last?.invoiceNumber ?? null,
        updatedAt: now,
      };
    });

    const print = await loadPrintSnapshot(ctx, profile.organizationId, branchId);
    const { business, template } = print;
    const businessCapabilities = await loadBusinessConfiguration(ctx, profile.organizationId);
    const businessTerminology = await loadResolvedBusinessTerms(
      ctx,
      profile.organizationId,
      businessCapabilities.industryProfile,
    );
    const productImagesPolicy = await loadProductImagesPolicy(ctx, profile.organizationId);
    // Reuse the policy loaded earlier for lot alert resolution.
    const expiryPolicyForSnapshot = expiryPolicy;
    const branch = await ctx.db.get(branchId);

    let diningTables: Array<{
      id: string;
      branchId: string;
      name: string;
      code: string | null;
      seats: number | null;
      status: "active" | "inactive";
      sortOrder: number | null;
    }> = [];
    let diningSessions: Array<{
      id: string;
      branchId: string;
      tableId: string;
      tableName: string;
      status: "open" | "closed";
      openedBy: string;
      openedByName: string | null;
      openedAt: number;
      guestCount: number | null;
      note: string | null;
      syncStatus: "synced";
    }> = [];
    let diningSessionItems: Array<{
      id: string;
      sessionId: string;
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      lineTotal: number;
      modifiersJson: string;
      kitchenStatus: "pending" | "fired" | "ready" | "done" | "void";
      note: string | null;
      createdAt: number;
      updatedAt: number;
    }> = [];
    let kitchenTickets: Array<{
      id: string;
      branchId: string;
      sessionId: string;
      tableName: string;
      status: "open" | "ready" | "done" | "void";
      firedAt: number;
      updatedAt: number;
      linesJson: string;
    }> = [];
    if (hasBusinessCapability(businessCapabilities, "tables_orders")) {
      const tables = await ctx.db
        .query("diningTables")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
      diningTables = tables
        .filter((t) => t.status === "active")
        .filter((t) => (profile.role === "administrator" ? true : t.branchId === branchId))
        .map((t) => ({
          id: t._id as string,
          branchId: t.branchId as string,
          name: t.name,
          code: t.code ?? null,
          seats: t.seats ?? null,
          status: t.status,
          sortOrder: t.sortOrder ?? null,
        }));
      const tableNameById = new Map(tables.map((t) => [String(t._id), t.name]));
      const openSessions = await ctx.db
        .query("diningSessions")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "open"),
        )
        .collect();
      const scopedSessions = openSessions.filter((s) =>
        profile.role === "administrator" ? true : s.branchId === branchId,
      );
      diningSessions = scopedSessions.map((s) => ({
        id: s._id as string,
        branchId: s.branchId as string,
        tableId: s.tableId as string,
        tableName: tableNameById.get(String(s.tableId)) ?? "Table",
        status: s.status,
        openedBy: s.openedBy as string,
        openedByName: nameByUser.get(s.openedBy) ?? null,
        openedAt: s.openedAt,
        guestCount: s.guestCount ?? null,
        note: s.note ?? null,
        syncStatus: "synced" as const,
      }));
      for (const session of scopedSessions) {
        const items = await ctx.db
          .query("diningSessionItems")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();
        for (const item of items) {
          diningSessionItems.push({
            id: item._id as string,
            sessionId: item.sessionId as string,
            productId: item.productId as string,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            lineTotal: item.lineTotal,
            modifiersJson: item.modifiersJson,
            kitchenStatus: item.kitchenStatus,
            note: item.note ?? null,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          });
        }
        if (hasBusinessCapability(businessCapabilities, "kitchen_tickets")) {
          const tickets = await ctx.db
            .query("kitchenTickets")
            .withIndex("by_session", (q) => q.eq("sessionId", session._id))
            .collect();
          for (const ticket of tickets) {
            if (ticket.status !== "open" && ticket.status !== "ready") continue;
            const lines = await ctx.db
              .query("kitchenTicketLines")
              .withIndex("by_ticket", (q) => q.eq("ticketId", ticket._id))
              .collect();
            kitchenTickets.push({
              id: ticket._id as string,
              branchId: ticket.branchId as string,
              sessionId: ticket.sessionId as string,
              tableName: ticket.tableName,
              status: ticket.status,
              firedAt: ticket.firedAt,
              updatedAt: ticket.updatedAt,
              linesJson: JSON.stringify(
                lines.map((line) => ({
                  id: line._id as string,
                  productName: line.productName,
                  quantity: line.quantity,
                  modifiersLabel: line.modifiersLabel ?? null,
                  note: line.note ?? null,
                })),
              ),
            });
          }
        }
      }
    }

    let hotelRooms: Array<{
      id: string;
      branchId: string;
      name: string;
      roomType: string | null;
      defaultProductId: string | null;
      status: "available" | "occupied" | "dirty" | "maintenance" | "inactive";
      sortOrder: number | null;
    }> = [];
    let hotelStays: Array<{
      id: string;
      branchId: string;
      roomId: string;
      roomName: string;
      customerId: string;
      customerName: string;
      reservationId: string | null;
      status: "open" | "closed";
      checkInAt: number;
      notes: string | null;
      checkedInBy: string;
      checkedInByName: string | null;
      syncStatus: "synced";
    }> = [];
    let hotelFolioCharges: Array<{
      id: string;
      stayId: string;
      kind: "room" | "product" | "other";
      productId: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      lineTotal: number;
      status: "open" | "void";
      createdAt: number;
    }> = [];
    let hotelReservations: Array<{
      id: string;
      branchId: string;
      roomId: string | null;
      roomName: string | null;
      customerId: string;
      customerName: string;
      arrivalDate: string;
      departureDate: string;
      status: "booked" | "confirmed" | "checked_in" | "cancelled" | "no_show";
      guests: number | null;
      notes: string | null;
      createdAt: number;
      updatedAt: number;
      syncStatus: "synced";
    }> = [];
    if (hasBusinessCapability(businessCapabilities, "rooms_folio")) {
      const rooms = await ctx.db
        .query("hotelRooms")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
      hotelRooms = rooms
        .filter((r) => r.status !== "inactive")
        .filter((r) => (profile.role === "administrator" ? true : r.branchId === branchId))
        .map((r) => ({
          id: r._id as string,
          branchId: r.branchId as string,
          name: r.name,
          roomType: r.roomType ?? null,
          defaultProductId: (r.defaultProductId as string | undefined) ?? null,
          status: r.status,
          sortOrder: r.sortOrder ?? null,
        }));
      const roomNameById = new Map(rooms.map((r) => [String(r._id), r.name]));
      const openStays = await ctx.db
        .query("hotelStays")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "open"),
        )
        .collect();
      const scopedStays = openStays.filter((s) =>
        profile.role === "administrator" ? true : s.branchId === branchId,
      );
      for (const stay of scopedStays) {
        const customer = await ctx.db.get(stay.customerId);
        hotelStays.push({
          id: stay._id as string,
          branchId: stay.branchId as string,
          roomId: stay.roomId as string,
          roomName: roomNameById.get(String(stay.roomId)) ?? "Room",
          customerId: stay.customerId as string,
          customerName: customer?.name ?? "Guest",
          reservationId: (stay.reservationId as string | undefined) ?? null,
          status: stay.status,
          checkInAt: stay.checkInAt,
          notes: stay.notes ?? null,
          checkedInBy: stay.checkedInBy as string,
          checkedInByName: nameByUser.get(stay.checkedInBy) ?? null,
          syncStatus: "synced",
        });
        const charges = await ctx.db
          .query("hotelFolioCharges")
          .withIndex("by_stay", (q) => q.eq("stayId", stay._id))
          .collect();
        for (const charge of charges) {
          hotelFolioCharges.push({
            id: charge._id as string,
            stayId: charge.stayId as string,
            kind: charge.kind,
            productId: charge.productId as string,
            description: charge.description,
            quantity: charge.quantity,
            unitPrice: charge.unitPrice,
            discount: charge.discount,
            lineTotal: charge.lineTotal,
            status: charge.status,
            createdAt: charge.createdAt,
          });
        }
      }
    }
    if (hasBusinessCapability(businessCapabilities, "reservations")) {
      const rooms = await ctx.db
        .query("hotelRooms")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
      const roomNameById = new Map(rooms.map((r) => [String(r._id), r.name]));
      const today = new Date().toISOString().slice(0, 10);
      const untilDate = new Date();
      untilDate.setDate(untilDate.getDate() + 14);
      const until = untilDate.toISOString().slice(0, 10);
      const reservations = await ctx.db
        .query("hotelReservations")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
      for (const reservation of reservations) {
        if (profile.role !== "administrator" && reservation.branchId !== branchId) continue;
        if (reservation.status !== "booked" && reservation.status !== "confirmed") continue;
        if (reservation.departureDate < today) continue;
        if (reservation.arrivalDate > until) continue;
        const customer = await ctx.db.get(reservation.customerId);
        hotelReservations.push({
          id: reservation._id as string,
          branchId: reservation.branchId as string,
          roomId: (reservation.roomId as string | undefined) ?? null,
          roomName: reservation.roomId
            ? (roomNameById.get(String(reservation.roomId)) ?? null)
            : null,
          customerId: reservation.customerId as string,
          customerName: customer?.name ?? "Guest",
          arrivalDate: reservation.arrivalDate,
          departureDate: reservation.departureDate,
          status: reservation.status,
          guests: reservation.guests ?? null,
          notes: reservation.notes ?? null,
          createdAt: reservation.createdAt,
          updatedAt: reservation.updatedAt,
          syncStatus: "synced",
        });
      }
    }

    const canManage = profile.role === "administrator" || profile.role === "manager";

    let suppliers: Array<{
      id: string;
      name: string;
      contactName: string | null;
      phone: string | null;
      email: string | null;
      address: string | null;
      notes: string | null;
      status: "active" | "inactive";
      createdAt: number;
    }> = [];
    let wholesaleStock: Array<{
      id: string;
      productId: string;
      name: string;
      sku: string;
      unit: string;
      costPrice: number;
      sellingPrice: number;
      quantity: number;
      tracksExpiry: boolean;
    }> = [];
    let wholesalePurchases: Array<{
      id: string;
      reference: string;
      invoiceNumber: string | null;
      supplierId: string;
      supplierName: string;
      purchasedAt: number;
      itemCount: number;
      totalCost: number;
      amountPaid: number | null;
      notes: string | null;
      status: string;
      items: Array<{
        productId: string;
        productName: string;
        quantity: number;
        unitCost: number;
        unitSellingPrice: number | null;
        lineTotal: number;
      }>;
    }> = [];
    let supplierPayments: Array<{
      id: string;
      supplierId: string;
      purchaseId: string | null;
      amount: number;
      paidAt: number;
      method: "cash" | "card" | "mobile_money";
      note: string | null;
    }> = [];
    let wholesaleTransfers: Array<{
      id: string;
      productName: string;
      branchName: string;
      quantity: number;
      note: string | null;
      createdAt: number;
    }> = [];
    let staff: Array<{
      id: string;
      userId: string;
      name: string;
      role: string;
      branch: string;
      branchId: string | null;
      phone: string | null;
      status: string;
      email: string | null;
      imageUrl: string | null;
      presence: "online" | "offline";
      lastSeenAt: number | null;
      lastLoginAt: number | null;
      lastDevice: string | null;
    }> = [];
    let expenses: Array<{
      id: string;
      amount: number;
      category: string;
      occurredAt: number;
      description: string | null;
      recordedByName: string;
      recordedByUserId: string;
      branchId: string | null;
      branchName: string | null;
      beneficiaryProfileId: string | null;
      payPeriodKey: string | null;
      paymentStatus: "paid" | "void" | null;
      sourceKind: "salary" | "commission" | "reimbursement" | null;
    }> = [];
    let staffCompensation: Array<{
      id: string;
      salaryAmount: number | null;
      salaryFrequency: "monthly" | "weekly";
      commissionRate: number | null;
      commissionBasis: "net" | "gross";
      updatedAt: number;
    }> = [];

    if (canManage) {
      const [
        supplierRows,
        wholesaleRows,
        purchaseRows,
        transferRows,
        expenseRows,
        compensationRows,
      ] = await Promise.all([
        ctx.db
          .query("suppliers")
          .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
          .collect(),
        ctx.db
          .query("wholesaleStock")
          .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
          .collect(),
        ctx.db
          .query("supplierPurchases")
          .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
          .collect(),
        ctx.db
          .query("stockTransfers")
          .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
          .collect(),
        ctx.db
          .query("expenses")
          .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
          .collect(),
        ctx.db
          .query("staffCompensation")
          .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
          .collect(),
      ]);

      const productById = new Map(activeProducts.map((p) => [p._id, p]));
      suppliers = supplierRows.map((row) => ({
        id: row._id as string,
        name: row.name,
        contactName: row.contactName ?? null,
        phone: row.phone ?? null,
        email: row.email ?? null,
        address: row.address ?? null,
        notes: row.notes ?? null,
        status: row.status,
        createdAt: row.createdAt,
      }));
      wholesaleStock = wholesaleRows.map((row) => {
        const product = productById.get(row.productId);
        return {
          id: row._id as string,
          productId: row.productId as string,
          name: product?.name ?? "Unknown",
          sku: product?.sku ?? "",
          unit: product?.unit ?? "",
          costPrice: showCost ? (product?.costPrice ?? 0) : 0,
          sellingPrice: product?.sellingPrice ?? 0,
          quantity: row.quantity,
          tracksExpiry: product?.tracksExpiry ?? false,
        };
      });
      const supplierName = new Map(supplierRows.map((s) => [s._id, s.name]));
      const recentPurchases = purchaseRows
        .sort((a, b) => b.purchasedAt - a.purchasedAt)
        .slice(0, 80);
      const recentPurchaseIds = new Set(recentPurchases.map((row) => row._id));
      const openDebt = purchaseRows.filter(
        (row) =>
          row.status === "completed" &&
          !recentPurchaseIds.has(row._id) &&
          purchaseBalance(row) > 0,
      );
      const purchasesForMirror = [...recentPurchases, ...openDebt];
      const purchaseItemGroups = await Promise.all(
        purchasesForMirror.map((row) =>
          ctx.db
            .query("supplierPurchaseItems")
            .withIndex("by_purchase", (q) => q.eq("purchaseId", row._id))
            .collect(),
        ),
      );
      wholesalePurchases = purchasesForMirror.map((row, index) => ({
        id: row._id as string,
        reference: row.reference,
        invoiceNumber: row.invoiceNumber ?? null,
        supplierId: row.supplierId as string,
        supplierName: supplierName.get(row.supplierId) ?? "Supplier",
        purchasedAt: row.purchasedAt,
        itemCount: row.itemCount,
        totalCost: row.totalCost,
        amountPaid: row.amountPaid ?? null,
        notes: row.notes ?? null,
        status: row.status,
        items: (purchaseItemGroups[index] ?? []).map((item) => ({
          productId: item.productId as string,
          productName: item.productName,
          quantity: item.quantity,
          unitCost: item.unitCost,
          unitSellingPrice: item.unitSellingPrice ?? null,
          lineTotal: item.lineTotal,
        })),
      }));
      const paymentRows = await ctx.db
        .query("supplierPayments")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
      supplierPayments = paymentRows
        .sort((a, b) => b.paidAt - a.paidAt)
        .slice(0, 400)
        .map((row) => ({
          id: row._id as string,
          supplierId: row.supplierId as string,
          purchaseId: (row.purchaseId as string | undefined) ?? null,
          amount: row.amount,
          paidAt: row.paidAt,
          method: row.method,
          note: row.note ?? null,
        }));
      wholesaleTransfers = transferRows
        .filter((row) => (row.kind ?? "branch") === "wholesale")
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 80)
        .map((row) => ({
          id: row._id as string,
          productName: productById.get(row.productId)?.name ?? "Product",
          branchName: branchNameById.get(row.toBranchId) ?? "Branch",
          quantity: row.quantity,
          note: row.note ?? null,
          createdAt: row.createdAt,
        }));
      expenses = expenseRows
        .sort((a, b) => b.occurredAt - a.occurredAt)
        .slice(0, 200)
        .map((row) => ({
          id: row._id as string,
          amount: row.amount,
          category: row.category,
          occurredAt: row.occurredAt,
          description: row.description ?? null,
          recordedByName: nameByUser.get(row.recordedBy) ?? "Unknown",
          recordedByUserId: row.recordedBy as string,
          branchId: (row.branchId as string | undefined) ?? null,
          branchName: row.branchId ? (branchNameById.get(row.branchId) ?? null) : null,
          beneficiaryProfileId: (row.beneficiaryProfileId as string | undefined) ?? null,
          payPeriodKey: row.payPeriodKey ?? null,
          paymentStatus: (row.paymentStatus as "paid" | "void" | null) ?? null,
          sourceKind: (row.sourceKind as "salary" | "commission" | "reimbursement" | null) ?? null,
        }));
      staffCompensation = compensationRows.map((row) => ({
        id: row.profileId as string,
        salaryAmount: row.salaryAmount ?? null,
        salaryFrequency: row.salaryFrequency,
        commissionRate: row.commissionRate ?? null,
        commissionBasis: row.commissionBasis,
        updatedAt: row.updatedAt,
      }));

      const filteredProfiles = profiles.filter((p) =>
        profile.role === "manager"
          ? p.branchId === profile.branchId && (p.role === "cashier" || p._id === profile._id)
          : true,
      );
      staff = await Promise.all(
        filteredProfiles.map(async (p) => {
          const { lastSeenAt, presence } = presenceFromLastSeenAt(p.lastSeenAt, now);
          const imageUrl = p.imageStorageId ? await ctx.storage.getUrl(p.imageStorageId) : null;
          return {
            id: p._id as string,
            userId: p.userId as string,
            name: p.name,
            role: p.role,
            branch: p.branchId
              ? (branchNameById.get(p.branchId) ?? p.branch ?? "")
              : (p.branch ?? ""),
            branchId: (p.branchId as string | undefined) ?? null,
            phone: p.phone ?? null,
            status: p.status,
            email: null,
            imageUrl,
            presence,
            lastSeenAt,
            lastLoginAt: p.lastLoginAt ?? null,
            lastDevice: p.lastDevice ?? null,
          };
        }),
      );
      const authUsers = await Promise.all(
        staff.map((row) => ctx.db.get(row.userId as Id<"users">)),
      );
      const emailById = new Map(
        authUsers.flatMap((u) => (u ? [[String(u._id), u.email ?? null] as const] : [])),
      );
      staff = staff.map((row) => ({
        ...row,
        email: emailById.get(row.userId) ?? null,
      }));
    }

    const returnRows = await ctx.db
      .query("saleReturns")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const invoiceBySale = new Map(orderSales.map((s) => [s._id, s.invoiceNumber]));
    let scopedReturns = returnRows.filter((row) => row.status === "completed");
    if (profile.role === "cashier") {
      const cashierSaleIds = new Set(orderSales.map((sale) => sale._id));
      scopedReturns = scopedReturns.filter(
        (row) => row.branchId === branchId && cashierSaleIds.has(row.saleId),
      );
    } else if (profile.role === "manager") {
      scopedReturns = scopedReturns.filter((row) => row.branchId === branchId);
    }
    const returns = scopedReturns
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, 100)
      .map((row) => ({
        id: row._id as string,
        returnNumber: row.returnNumber,
        saleId: row.saleId as string,
        invoiceNumber: invoiceBySale.get(row.saleId) ?? null,
        refundAmount: row.refundAmount,
        itemCount: row.itemCount,
        kind: row.kind ?? "partial",
        completedAt: row.completedAt,
        branchId: row.branchId as string,
        branchName: branchNameById.get(row.branchId) ?? null,
        customerName: row.customerName,
        cashierName: nameByUser.get(row.processedBy) ?? "Cashier",
        reason: row.reason,
        status: row.status,
      }));

    const lots: Array<{
      id: string;
      productId: string;
      branchId: string;
      branchName: string | null;
      quantity: number;
      expiryDate: string;
      lotCode: string;
      receivedAt: number;
    }> = [];
    for (const stockBranchId of stockBranchIds) {
      const branchLots = await ctx.db
        .query("inventoryLots")
        .withIndex("by_branch", (q) => q.eq("branchId", stockBranchId))
        .collect();
      for (const lot of branchLots) {
        if (lot.quantity <= 0 || lot.organizationId !== organizationId) continue;
        lots.push({
          id: lot._id as string,
          productId: lot.productId as string,
          branchId: lot.branchId as string,
          branchName: branchNameById.get(lot.branchId) ?? null,
          quantity: lot.quantity,
          expiryDate: lot.expiryDate,
          lotCode: lot.lotCode ?? lot.expiryDate,
          receivedAt: lot.receivedAt,
        });
      }
    }

    return {
      products: mirroredProducts,
      branchStock: branchStockRows,
      categories: categories.map((c) => ({
        id: c._id as string,
        name: c.name,
        slug: c.slug,
        isActive: c.isActive,
      })),
      customers,
      orders: mirroredOrders,
      orderItems,
      suppliers,
      wholesaleStock,
      wholesalePurchases,
      supplierPayments,
      wholesaleTransfers,
      branches: branches
        .filter((b) => (profile.role === "administrator" ? true : b._id === branchId))
        .map((b) => ({
          id: b._id as string,
          name: b.name,
          code: b.code,
          address: b.address ?? null,
          phone: b.phone ?? null,
          status: b.status,
        })),
      users: staff,
      expenses,
      staffCompensation,
      returns,
      lots,
      print: {
        business,
        template,
      },
      businessCapabilities,
      businessTerminology,
      productImagesPolicy,
      expiryPolicy: expiryPolicyForSnapshot,
      diningTables,
      diningSessions,
      diningSessionItems,
      kitchenTickets,
      hotelRooms,
      hotelStays,
      hotelFolioCharges,
      hotelReservations,
      profile: {
        userId: userId as string,
        name: profile.name,
        role: profile.role as "administrator" | "manager" | "cashier",
        branchId: branchId as string,
        branchName: branch?.name ?? null,
        organizationId: organizationId as string,
        organizationName: business.tradeName,
        tourProgress: await loadTourProgressForUser(ctx, userId, profile),
      },
    };
  },
});
