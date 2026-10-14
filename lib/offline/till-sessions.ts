/**
 * Dexie-only till (cash drawer) sessions for Millie's.
 * No Convex — open/close/expected totals live entirely on this device.
 */

import { roundMoney } from "@/lib/currency";
import {
  addReportPaymentTotal,
  emptyReportPaymentTotals,
  type ReportPaymentTotals,
} from "@/lib/payments";
import { getMeta, getOfflineDb, META_KEYS, type NovendOfflineDb } from "./db";
import { notifyReplicaChanged } from "./replica-events";
import type { LocalTillSession } from "./types";

export type TillExpectedTotals = {
  saleCount: number;
  grossSales: number;
  returnsTotal: number;
  expectedCash: number;
  expectedCard: number;
  expectedMobileMoney: number;
  expectedOnAccount: number;
};

export type TillSessionSummary = Pick<
  LocalTillSession,
  | "id"
  | "cashierId"
  | "cashierName"
  | "branchId"
  | "status"
  | "openedAt"
  | "closedAt"
  | "openingFloat"
  | "saleCount"
  | "grossSales"
  | "varianceCash"
  | "autoStarted"
>;

async function requireDb(): Promise<NovendOfflineDb> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage unavailable");
  return db;
}

async function sessionCashier(db: NovendOfflineDb) {
  const cashierId = (await getMeta(db, META_KEYS.profileUserId))?.trim();
  const cashierName = (await getMeta(db, META_KEYS.profileName))?.trim() || "Cashier";
  if (!cashierId) throw new Error("Sign in on this till before starting sales.");
  return { cashierId, cashierName };
}

/** Open till session for the signed-in cashier, if any. */
export async function getOpenTillSession(): Promise<LocalTillSession | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const cashierId = (await getMeta(db, META_KEYS.profileUserId))?.trim();
  if (!cashierId) return null;
  const open = await db.tillSessions
    .where("[cashierId+status]")
    .equals([cashierId, "open"])
    .first();
  return open ?? null;
}

/** Start today's till. Opening float defaults to 0. */
export async function startToday(input?: {
  openingFloat?: number;
  branchId?: string;
}): Promise<LocalTillSession> {
  const db = await requireDb();
  const { cashierId, cashierName } = await sessionCashier(db);
  const existing = await db.tillSessions
    .where("[cashierId+status]")
    .equals([cashierId, "open"])
    .first();
  if (existing) {
    throw new Error("You already started today. Close today before starting again.");
  }

  const openingFloat = roundMoney(
    Number.isFinite(input?.openingFloat) && (input?.openingFloat ?? 0) >= 0
      ? (input?.openingFloat ?? 0)
      : 0,
  );
  const session: LocalTillSession = {
    id: crypto.randomUUID(),
    cashierId,
    cashierName,
    branchId: input?.branchId,
    status: "open",
    openedAt: Date.now(),
    openingFloat,
    autoStarted: false,
  };
  await db.tillSessions.put(session);
  notifyReplicaChanged({ flush: true });
  return session;
}

/**
 * Ensure an open till exists before completing a sale.
 * Auto-starts with opening float 0 when none is open.
 */
export async function ensureTillOpenForSale(input?: {
  branchId?: string;
}): Promise<LocalTillSession> {
  const db = await requireDb();
  const { cashierId, cashierName } = await sessionCashier(db);
  const existing = await db.tillSessions
    .where("[cashierId+status]")
    .equals([cashierId, "open"])
    .first();
  if (existing) return existing;

  const session: LocalTillSession = {
    id: crypto.randomUUID(),
    cashierId,
    cashierName,
    branchId: input?.branchId,
    status: "open",
    openedAt: Date.now(),
    openingFloat: 0,
    autoStarted: true,
  };
  await db.tillSessions.put(session);
  notifyReplicaChanged({ flush: true });
  return session;
}

async function computeExpected(
  db: NovendOfflineDb,
  session: LocalTillSession,
  closedAt: number,
): Promise<TillExpectedTotals> {
  const sales = (await db.localSales.toArray()).filter((sale) => {
    if (sale.cashierId !== session.cashierId) return false;
    if (session.branchId && sale.branchId && sale.branchId !== session.branchId) return false;
    if (sale.completedAt < session.openedAt || sale.completedAt > closedAt) return false;
    return true;
  });

  let tenders = emptyReportPaymentTotals();
  let grossSales = 0;
  for (const sale of sales) {
    tenders = addReportPaymentTotal(
      tenders,
      sale.paymentMethod,
      sale.total,
      sale.payments,
    );
    grossSales += sale.total;
  }

  const saleIds = new Set(sales.map((s) => s.id));
  const returns = (await db.localReturns.toArray()).filter((row) => {
    if (row.completedAt < session.openedAt || row.completedAt > closedAt) return false;
    return saleIds.has(row.saleId);
  });
  let returnsTotal = 0;
  for (const row of returns) {
    returnsTotal += row.refundAmount;
    // Refunds reduce cash expected in the drawer (supermarket default).
    tenders = {
      ...tenders,
      cash: tenders.cash - row.refundAmount,
    };
  }

  return {
    saleCount: sales.length,
    grossSales: roundMoney(grossSales),
    returnsTotal: roundMoney(returnsTotal),
    expectedCash: roundMoney(session.openingFloat + tenders.cash),
    expectedCard: roundMoney(tenders.card),
    expectedMobileMoney: roundMoney(tenders.mobileMoney),
    expectedOnAccount: roundMoney(tenders.onAccount ?? 0),
  };
}

export async function previewCloseToday(
  sessionId?: string,
): Promise<(TillExpectedTotals & { session: LocalTillSession }) | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const open =
    (sessionId ? await db.tillSessions.get(sessionId) : null) ?? (await getOpenTillSession());
  if (!open || open.status !== "open") return null;
  const expected = await computeExpected(db, open, Date.now());
  return { session: open, ...expected };
}

export async function closeToday(input: {
  sessionId: string;
  countedCash: number;
  countedCard: number;
  countedMobileMoney: number;
  notes?: string;
}): Promise<LocalTillSession & TillExpectedTotals> {
  const db = await requireDb();
  const session = await db.tillSessions.get(input.sessionId);
  if (!session) throw new Error("Till session not found");
  if (session.status !== "open") throw new Error("This day is already closed");

  for (const [label, value] of [
    ["cash", input.countedCash],
    ["card", input.countedCard],
    ["mobile money", input.countedMobileMoney],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Counted ${label} must be zero or greater`);
    }
  }

  const closedAt = Date.now();
  const expected = await computeExpected(db, session, closedAt);
  const countedCash = roundMoney(input.countedCash);
  const countedCard = roundMoney(input.countedCard);
  const countedMobileMoney = roundMoney(input.countedMobileMoney);

  const closed: LocalTillSession = {
    ...session,
    status: "closed",
    closedAt,
    countedCash,
    countedCard,
    countedMobileMoney,
    expectedCash: expected.expectedCash,
    expectedCard: expected.expectedCard,
    expectedMobileMoney: expected.expectedMobileMoney,
    expectedOnAccount: expected.expectedOnAccount,
    saleCount: expected.saleCount,
    grossSales: expected.grossSales,
    returnsTotal: expected.returnsTotal,
    varianceCash: roundMoney(countedCash - expected.expectedCash),
    varianceCard: roundMoney(countedCard - expected.expectedCard),
    varianceMobileMoney: roundMoney(countedMobileMoney - expected.expectedMobileMoney),
    notes: input.notes?.trim().slice(0, 500) || undefined,
  };
  await db.tillSessions.put(closed);
  notifyReplicaChanged({ flush: true });
  return { ...closed, ...expected };
}

/** Sessions that opened on a UTC calendar day (for reports). */
export async function listTillSessionsForUtcDay(date: string): Promise<TillSessionSummary[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const db = await getOfflineDb();
  if (!db) return [];
  const start = Date.parse(`${date}T00:00:00.000Z`);
  const end = Date.parse(`${date}T23:59:59.999Z`);
  const rows = await db.tillSessions
    .where("openedAt")
    .between(start, end, true, true)
    .reverse()
    .toArray();
  return rows.map(toSummary);
}

/** Recent sessions for analytics (newest first). */
export async function listRecentTillSessions(limit = 30): Promise<TillSessionSummary[]> {
  const db = await getOfflineDb();
  if (!db) return [];
  const rows = await db.tillSessions.orderBy("openedAt").reverse().limit(limit).toArray();
  return rows.map(toSummary);
}

function toSummary(row: LocalTillSession): TillSessionSummary {
  return {
    id: row.id,
    cashierId: row.cashierId,
    cashierName: row.cashierName,
    branchId: row.branchId,
    status: row.status,
    openedAt: row.openedAt,
    closedAt: row.closedAt,
    openingFloat: row.openingFloat,
    saleCount: row.saleCount,
    grossSales: row.grossSales,
    varianceCash: row.varianceCash,
    autoStarted: row.autoStarted,
  };
}

export type { LocalTillSession };
