import { roundMoney } from "@/lib/currency";
import { computeCommissionEarned, isPayrollExpense, periodBounds } from "@/convex/shared/payroll";
import { getOfflineDb } from "./db";
import type {
  MirroredExpense,
  MirroredOrder,
  MirroredReturn,
  MirroredStaffCompensation,
} from "./types";

export type LocalStaffPerformance = {
  profileId: string;
  userId: string;
  startDate: number;
  endDate: number;
  orderCount: number;
  grossSales: number;
  netSales: number;
  refundTotal: number;
  returnCount: number;
  expensesRecordedCount: number;
  expensesRecordedTotal: number;
  staffExpenseTotal: number;
  salaryPaid: number;
  commissionPaid: number;
  commissionEarned: number;
  commissionOutstanding: number;
  orders: Array<{
    id: string;
    invoiceNumber: string;
    completedAt: number;
    customerName: string;
    total: number;
  }>;
  returns: Array<{
    id: string;
    returnNumber: string;
    completedAt: number;
    refundAmount: number;
    saleId: string;
  }>;
  expenses: Array<{
    id: string;
    amount: number;
    category: string;
    occurredAt: number;
    description: string | null;
    sourceKind: string | null;
    payPeriodKey: string | null;
  }>;
  source: "local";
};

function inRange(ts: number, start: number, end: number) {
  return ts >= start && ts <= end;
}

async function ordersForCashier(
  db: NonNullable<Awaited<ReturnType<typeof getOfflineDb>>>,
  userId: string,
  startDate: number,
  endDate: number,
) {
  const mirrored = (await db.orders.toArray()).filter(
    (row) => row.cashierId === userId && inRange(row.completedAt, startDate, endDate),
  );
  const local = (await db.localSales.toArray()).filter(
    (row) =>
      row.cashierId === userId &&
      row.syncStatus !== "synced" &&
      inRange(row.completedAt, startDate, endDate),
  );
  const sales: Array<MirroredOrder & { id: string }> = [...mirrored];
  for (const sale of local) {
    sales.push({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      customerId: sale.customerId ?? null,
      customerName: sale.customerName,
      cashierId: sale.cashierId,
      cashierName: sale.cashierName,
      itemCount: sale.itemCount,
      subtotal: sale.subtotal,
      discount: sale.discount,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      status: "completed",
      completedAt: sale.completedAt,
      branchId: sale.branchId ?? null,
      branchName: sale.branchName ?? null,
    });
  }
  return sales.sort((a, b) => b.completedAt - a.completedAt);
}

async function returnsForSales(
  db: NonNullable<Awaited<ReturnType<typeof getOfflineDb>>>,
  saleIds: Set<string>,
  startDate: number,
  endDate: number,
) {
  const mirrored = (await db.returns.toArray()).filter(
    (row) => saleIds.has(row.saleId) && inRange(row.completedAt, startDate, endDate),
  );
  const local = (await db.localReturns.toArray()).filter(
    (row) =>
      saleIds.has(row.saleId) &&
      row.syncStatus !== "synced" &&
      inRange(row.completedAt, startDate, endDate),
  );
  const rows: MirroredReturn[] = [...mirrored];
  for (const row of local) {
    rows.push({
      id: row.id,
      returnNumber: row.returnNumber,
      saleId: row.saleId,
      invoiceNumber: null,
      refundAmount: row.refundAmount,
      itemCount: row.itemCount,
      kind: "partial",
      completedAt: row.completedAt,
      branchId: null,
      branchName: null,
    });
  }
  return rows.sort((a, b) => b.completedAt - a.completedAt);
}

async function expensesForProfile(
  db: NonNullable<Awaited<ReturnType<typeof getOfflineDb>>>,
  profileId: string,
  startDate: number,
  endDate: number,
) {
  return (await db.expenses.toArray()).filter(
    (row) =>
      row.beneficiaryProfileId === profileId &&
      row.paymentStatus !== "void" &&
      inRange(row.occurredAt, startDate, endDate),
  );
}

export async function getLocalStaffCompensation(
  profileId: string,
): Promise<MirroredStaffCompensation | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  return (await db.staffCompensation.get(profileId)) ?? null;
}

export async function buildLocalStaffPerformance(args: {
  profileId: string;
  userId: string;
  startDate: number;
  endDate: number;
}): Promise<LocalStaffPerformance | null> {
  const db = await getOfflineDb();
  if (!db) return null;

  const compensation = await db.staffCompensation.get(args.profileId);
  const sales = await ordersForCashier(db, args.userId, args.startDate, args.endDate);
  const saleIds = new Set(sales.map((row) => row.id));
  const returns = await returnsForSales(db, saleIds, args.startDate, args.endDate);
  const forStaff = await expensesForProfile(db, args.profileId, args.startDate, args.endDate);
  const recorded = (await db.expenses.toArray()).filter(
    (row) =>
      row.recordedByUserId === args.userId && inRange(row.occurredAt, args.startDate, args.endDate),
  );

  const grossSales = roundMoney(sales.reduce((sum, row) => sum + row.total, 0));
  const refundTotal = roundMoney(returns.reduce((sum, row) => sum + row.refundAmount, 0));
  const netSales = roundMoney(Math.max(0, grossSales - refundTotal));
  const commissionEarned = computeCommissionEarned({
    netSales,
    grossSales,
    rate: compensation?.commissionRate ?? 0,
    basis: compensation?.commissionBasis ?? "net",
  });
  const salaryPaid = roundMoney(
    forStaff.filter((row) => row.sourceKind === "salary").reduce((sum, row) => sum + row.amount, 0),
  );
  const commissionPaid = roundMoney(
    forStaff
      .filter((row) => row.sourceKind === "commission")
      .reduce((sum, row) => sum + row.amount, 0),
  );

  return {
    profileId: args.profileId,
    userId: args.userId,
    startDate: args.startDate,
    endDate: args.endDate,
    orderCount: sales.length,
    grossSales,
    netSales,
    refundTotal,
    returnCount: returns.length,
    expensesRecordedCount: recorded.length,
    expensesRecordedTotal: roundMoney(recorded.reduce((sum, row) => sum + row.amount, 0)),
    staffExpenseTotal: roundMoney(forStaff.reduce((sum, row) => sum + row.amount, 0)),
    salaryPaid,
    commissionPaid,
    commissionEarned,
    commissionOutstanding: roundMoney(Math.max(0, commissionEarned - commissionPaid)),
    orders: sales.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      completedAt: row.completedAt,
      customerName: row.customerName,
      total: row.total,
    })),
    returns: returns.map((row) => ({
      id: row.id,
      returnNumber: row.returnNumber,
      completedAt: row.completedAt,
      refundAmount: row.refundAmount,
      saleId: row.saleId,
    })),
    expenses: forStaff.map((row) => mapExpenseRow(row)),
    source: "local",
  };
}

function mapExpenseRow(row: MirroredExpense) {
  return {
    id: row.id,
    amount: row.amount,
    category: row.category,
    occurredAt: row.occurredAt,
    description: row.description,
    sourceKind: row.sourceKind ?? null,
    payPeriodKey: row.payPeriodKey ?? null,
  };
}

export type LocalStaffMonthRecord = {
  profileId: string;
  name: string;
  payPeriodKey: string;
  salaryDue: number;
  salaryPaid: number;
  salaryStatus: "paid" | "unpaid";
  commissionEarned: number;
  commissionPaid: number;
  commissionOutstanding: number;
  otherExpenses: number;
  totalStaffCost: number;
  orderCount: number;
  netSales: number;
  source: "local";
};

export async function buildLocalStaffMonthRecord(args: {
  profileId: string;
  userId: string;
  userName: string;
  payPeriodKey: string;
}): Promise<LocalStaffMonthRecord | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const { start, end } = periodBounds(args.payPeriodKey);
  const compensation = await db.staffCompensation.get(args.profileId);
  const performance = await buildLocalStaffPerformance({
    profileId: args.profileId,
    userId: args.userId,
    startDate: start,
    endDate: end,
  });
  if (!performance) return null;

  const forStaff = await expensesForProfile(db, args.profileId, start, end);
  const salaryDue = compensation?.salaryAmount ?? 0;
  const salaryPaid = performance.salaryPaid;
  const otherExpenses = roundMoney(
    forStaff.filter((row) => !isPayrollExpense(row)).reduce((sum, row) => sum + row.amount, 0),
  );

  return {
    profileId: args.profileId,
    name: args.userName,
    payPeriodKey: args.payPeriodKey,
    salaryDue,
    salaryPaid,
    salaryStatus: salaryDue > 0 && salaryPaid >= salaryDue ? "paid" : "unpaid",
    commissionEarned: performance.commissionEarned,
    commissionPaid: performance.commissionPaid,
    commissionOutstanding: performance.commissionOutstanding,
    otherExpenses,
    totalStaffCost: roundMoney(salaryPaid + performance.commissionPaid + otherExpenses),
    orderCount: performance.orderCount,
    netSales: performance.netSales,
    source: "local",
  };
}

export type LocalStaffMonthRosterRow = {
  profileId: string;
  name: string;
  role: string;
  salaryDue: number;
  salaryPaid: number;
  salaryStatus: "paid" | "unpaid";
  commissionEarned: number;
  commissionPaid: number;
  totalStaffCost: number;
};

export async function buildLocalStaffMonthRoster(
  payPeriodKey: string,
): Promise<LocalStaffMonthRosterRow[]> {
  const db = await getOfflineDb();
  if (!db) return [];
  const users = await db.users.toArray();
  const rows: LocalStaffMonthRosterRow[] = [];
  for (const user of users) {
    const record = await buildLocalStaffMonthRecord({
      profileId: user.id,
      userId: user.userId,
      userName: user.name,
      payPeriodKey,
    });
    if (!record) continue;
    if (
      record.salaryDue <= 0 &&
      record.commissionEarned <= 0 &&
      record.salaryPaid <= 0 &&
      record.commissionPaid <= 0
    ) {
      continue;
    }
    rows.push({
      profileId: user.id,
      name: user.name,
      role: user.role,
      salaryDue: record.salaryDue,
      salaryPaid: record.salaryPaid,
      salaryStatus: record.salaryStatus,
      commissionEarned: record.commissionEarned,
      commissionPaid: record.commissionPaid,
      totalStaffCost: record.totalStaffCost,
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
