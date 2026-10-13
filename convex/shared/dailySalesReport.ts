import { businessDateKey, businessTimeZone } from "./businessDate";
import { appendSmsLink } from "./smsAudience";

export type PaymentTotals = {
  cash: number;
  card: number;
  mobileMoney: number;
  /** Sold on customer credit (receivable), not money in the till. */
  onAccount: number;
};

export type DailySalesFigures = PaymentTotals & {
  saleCount: number;
  gross: number;
  returnCount: number;
  returns: number;
};

type TenderMethod = "cash" | "card" | "mobile_money" | "on_account";
type SaleRow = {
  total: number;
  paymentMethod: TenderMethod;
  /** Split tenders. Absent on legacy sales: the whole total is the primary method. */
  payments?: Array<{ method: TenderMethod; amount: number }>;
};
type ReturnRow = { refundAmount: number; status: "completed" | "pending" };

export function emptyDailySales(): DailySalesFigures {
  return {
    saleCount: 0,
    gross: 0,
    returnCount: 0,
    returns: 0,
    cash: 0,
    card: 0,
    mobileMoney: 0,
    onAccount: 0,
  };
}

export function addSale(figures: DailySalesFigures, sale: SaleRow): DailySalesFigures {
  const total = roundMoney(sale.total);
  const lines =
    sale.payments && sale.payments.length > 0
      ? sale.payments
      : [{ method: sale.paymentMethod, amount: total }];
  const next: DailySalesFigures = {
    ...figures,
    saleCount: figures.saleCount + 1,
    gross: roundMoney(figures.gross + total),
  };
  for (const line of lines) {
    const amount = roundMoney(line.amount);
    if (line.method === "card") next.card = roundMoney(next.card + amount);
    else if (line.method === "mobile_money") {
      next.mobileMoney = roundMoney(next.mobileMoney + amount);
    } else if (line.method === "on_account") {
      next.onAccount = roundMoney(next.onAccount + amount);
    } else next.cash = roundMoney(next.cash + amount);
  }
  return next;
}

export function addReturn(figures: DailySalesFigures, row: ReturnRow): DailySalesFigures {
  if (row.status !== "completed") return figures;
  return {
    ...figures,
    returnCount: figures.returnCount + 1,
    returns: roundMoney(figures.returns + row.refundAmount),
  };
}

export function netSales(figures: DailySalesFigures) {
  return roundMoney(figures.gross - figures.returns);
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatMoney(amount: number, currency = "GHS") {
  const code = currency.trim() || "GHS";
  const formatted = roundMoney(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${code} ${formatted}`;
}

/** `8 Oct` from `YYYY-MM-DD`, without shifting the calendar day. */
export function formatReportDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function zoneHour(at: number, timeZone?: string | null) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: businessTimeZone(timeZone),
    hour: "2-digit",
    hour12: false,
  }).format(new Date(at));
  const parsed = Number(hour);
  return Number.isFinite(parsed) ? parsed % 24 : 0;
}

/**
 * The business day to close. After 8pm local, that is today. Earlier, yesterday,
 * so a morning cron does not report a day that is still open.
 */
export function reportDateKey(now: number, timeZone?: string | null) {
  const zone = businessTimeZone(timeZone);
  const today = businessDateKey(now, zone);
  if (zoneHour(now, zone) >= 20) return today;
  return businessDateKey(now - 24 * 60 * 60 * 1000, zone);
}

function zoneOffsetMs(at: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(at));
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  let hour = Number(value("hour"));
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    Number(value("year")),
    Number(value("month")) - 1,
    Number(value("day")),
    hour,
    Number(value("minute")),
    Number(value("second")),
  );
  return asUtc - at;
}

/** Inclusive start and exclusive end for a business calendar day. */
export function businessDayRange(dateKey: string, timeZone?: string | null) {
  const zone = businessTimeZone(timeZone);
  const guess = Date.parse(`${dateKey}T00:00:00Z`);
  let start = guess - zoneOffsetMs(guess, zone);
  if (businessDateKey(start, zone) !== dateKey) {
    start -= zoneOffsetMs(start, zone) - zoneOffsetMs(guess, zone);
  }
  for (let step = 0; businessDateKey(start, zone) !== dateKey && step < 48; step += 1) {
    start += 60 * 60 * 1000;
  }
  for (let step = 0; businessDateKey(start - 1, zone) === dateKey && step < 180; step += 1) {
    start -= 60 * 1000;
  }
  let end = start + 24 * 60 * 60 * 1000;
  for (let step = 0; businessDateKey(end, zone) === dateKey && step < 180; step += 1) {
    end += 60 * 1000;
  }
  for (
    let step = 0;
    end > start && businessDateKey(end - 1, zone) !== dateKey && step < 180;
    step += 1
  ) {
    end -= 60 * 1000;
  }
  return { start, end };
}

export function dailySalesSms(input: {
  organizationName: string;
  dateKey: string;
  currency: string;
  figures: DailySalesFigures;
  reportsUrl?: string;
}) {
  const business = input.organizationName.trim() || "Your business";
  const when = formatReportDate(input.dateKey);
  const money = (amount: number) => formatMoney(amount, input.currency);
  if (input.figures.saleCount === 0 && input.figures.returnCount === 0) {
    return appendSmsLink(
      `Novend daily: ${business}, ${when}. No completed sales.`,
      input.reportsUrl,
    );
  }
  const parts = [
    `Novend daily: ${business}, ${when}.`,
    `${input.figures.saleCount} sale${input.figures.saleCount === 1 ? "" : "s"}, ${money(input.figures.gross)}.`,
  ];
  const tenders = [
    input.figures.cash > 0 ? `Cash ${money(input.figures.cash)}` : null,
    input.figures.mobileMoney > 0 ? `MoMo ${money(input.figures.mobileMoney)}` : null,
    input.figures.card > 0 ? `Card ${money(input.figures.card)}` : null,
    input.figures.onAccount > 0 ? `On account ${money(input.figures.onAccount)}` : null,
  ].filter(Boolean);
  if (tenders.length > 0) parts.push(`${tenders.join(", ")}.`);
  if (input.figures.returnCount > 0) {
    parts.push(
      `Returns ${money(input.figures.returns)} (${input.figures.returnCount}). Net ${money(netSales(input.figures))}.`,
    );
  }
  return appendSmsLink(parts.join(" "), input.reportsUrl);
}

export function dailySalesInbox(input: {
  organizationName: string;
  dateKey: string;
  currency: string;
  figures: DailySalesFigures;
}) {
  const when = formatReportDate(input.dateKey);
  const text = dailySalesSms(input).replace(/^Novend daily:\s*/, "");
  return {
    title: `Daily sales · ${when}`.slice(0, 120),
    body: text.slice(0, 280),
    href: "/reports",
  };
}
