import { sumInventoryValues } from "./dashboardFinance";

export type InventoryValueStock = {
  key: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  tracksInventory?: boolean;
};

export type InventoryValueMovement = {
  key: string;
  quantityChange: number;
  at: number;
};

export type InventoryValuePoint = {
  date: string;
  cost: number;
  sell: number;
};

const MAX_DAYS = 400;

function utcDayKey(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}

function utcDayStart(key: string) {
  return Date.parse(`${key}T00:00:00.000Z`);
}

export function inventoryValueDates(startDate: number, endDate: number): string[] {
  const days: string[] = [];
  let cursor = utcDayStart(utcDayKey(startDate));
  const last = utcDayStart(utcDayKey(endDate));
  while (cursor <= last && days.length < MAX_DAYS) {
    days.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += 24 * 60 * 60 * 1000;
  }
  return days;
}

function valueOf(qty: Map<string, number>, stock: InventoryValueStock[]) {
  return sumInventoryValues(
    stock.map((row) => ({
      onHand: qty.get(row.key) ?? 0,
      costPrice: row.costPrice,
      sellingPrice: row.sellingPrice,
      tracksInventory: row.tracksInventory,
    })),
  );
}

/**
 * End-of-day stock value for a report range.
 * Quantities are replayed from current on-hand. Prices are today's cost and
 * selling price — this history does not store the price at the time of each movement.
 */
export function buildInventoryValueSeries(args: {
  stock: InventoryValueStock[];
  movements: InventoryValueMovement[];
  startDate: number;
  endDate: number;
}): { points: InventoryValuePoint[]; truncated: boolean; opening: { cost: number; sell: number }; closing: { cost: number; sell: number } } {
  const dates = inventoryValueDates(args.startDate, args.endDate);
  const truncated =
    dates.length >= MAX_DAYS &&
    utcDayStart(dates[dates.length - 1]!) < utcDayStart(utcDayKey(args.endDate));
  const qty = new Map(args.stock.map((row) => [row.key, row.quantity]));
  const movements = args.movements.filter((row) => row.key && Number.isFinite(row.at));

  for (const movement of movements) {
    if (movement.at <= args.endDate) continue;
    qty.set(movement.key, (qty.get(movement.key) ?? 0) - movement.quantityChange);
  }

  const closing = valueOf(qty, args.stock);
  const points: InventoryValuePoint[] = [];
  let asOf = args.endDate;
  for (let index = dates.length - 1; index >= 0; index -= 1) {
    const date = dates[index]!;
    const dayEnd = Math.min(Date.parse(`${date}T23:59:59.999Z`), args.endDate);
    for (const movement of movements) {
      if (movement.at > dayEnd && movement.at <= asOf) {
        qty.set(movement.key, (qty.get(movement.key) ?? 0) - movement.quantityChange);
      }
    }
    const totals = valueOf(qty, args.stock);
    points.push({
      date,
      cost: totals.cost,
      sell: totals.sell,
    });
    asOf = dayEnd;
  }

  for (const movement of movements) {
    if (movement.at < args.startDate || movement.at > asOf) continue;
    qty.set(movement.key, (qty.get(movement.key) ?? 0) - movement.quantityChange);
  }
  const opening = valueOf(qty, args.stock);

  points.reverse();
  return { points, truncated, opening, closing };
}

export function findInventoryValueDays(
  points: InventoryValuePoint[],
  target: number,
  basis: "cost" | "sell",
): { exact: InventoryValuePoint[]; closest: InventoryValuePoint | null } {
  if (!Number.isFinite(target) || points.length === 0) {
    return { exact: [], closest: null };
  }
  const exact = points.filter((point) => Math.abs(point[basis] - target) < 0.01);
  let closest: InventoryValuePoint | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const gap = Math.abs(point[basis] - target);
    if (gap < best) {
      best = gap;
      closest = point;
    }
  }
  return { exact, closest: exact.length > 0 ? null : closest };
}
