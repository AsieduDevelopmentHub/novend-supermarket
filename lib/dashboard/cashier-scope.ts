/**
 * Local dashboard must match Convex `dashboard.summary`: cashiers only see
 * their own sales, and only refunds against those sales.
 */
export function filterCashierDashboardSales<T extends { cashierId?: string | null }>(
  rows: T[],
  role: string,
  userId: string | null,
): T[] {
  if (role === "administrator" || role === "manager" || !userId) return rows;
  return rows.filter((row) => row.cashierId === userId);
}

export function filterCashierDashboardReturns<T extends { saleId: string }>(
  rows: T[],
  saleIds: Set<string>,
  role: string,
): T[] {
  if (role === "administrator" || role === "manager") return rows;
  return rows.filter((row) => saleIds.has(row.saleId));
}

/**
 * Sale ids a cashier may read. `null` means no extra sale filter (admin / manager).
 * Matches Convex `returns.list` / `sales.listOrders`: cashiers never see another
 * cashier's orders or refunds.
 */
export function ownedSaleIdsForCashier(
  role: string | null,
  userId: string | null,
  orders: Array<{ id: string; cashierId?: string | null }>,
  localSales: Array<{ id: string; cashierId?: string | null; serverSaleId?: string }>,
): Set<string> | null {
  if (role !== "cashier" || !userId) return null;
  const ids = new Set<string>();
  for (const order of orders) {
    if (order.cashierId === userId) ids.add(order.id);
  }
  for (const sale of localSales) {
    if (sale.cashierId !== userId) continue;
    ids.add(sale.id);
    if (sale.serverSaleId) ids.add(sale.serverSaleId);
  }
  return ids;
}
