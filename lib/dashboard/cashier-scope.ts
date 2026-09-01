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
